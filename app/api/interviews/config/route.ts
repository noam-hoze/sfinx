import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { createCandidates } from "server/data/interviews/meta/frontend-developer/createCandidates";

async function readText(p: string) {
    return (await fs.readFile(p, "utf8")).trim();
}

function extractQuestions(markdown: string): string[] {
    if (!markdown) return [];
    const lines = markdown.split(/\r?\n/);
    const startIdx = lines.findIndex((l) => /interview\s+questions/i.test(l));
    if (startIdx === -1) return [];
    const qs: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (/^\s*-{3,}\s*$/.test(line) || /^##+\s/.test(line)) break; // stop at --- or next heading
        const m = /^\*\s+(.*)$/.exec(line);
        if (m && m[1]) qs.push(m[1].trim());
    }
    return qs;
}

function deriveCharacteristics(score: number) {
    // Normalize to tiers
    if (score >= 8.5) {
        return {
            scale: 5,
            independence: 5,
            creativity: 5,
            testingCode: 5,
            documenting: 4,
            speed: 5,
            thoroughness: 5,
            collaboration: 4,
            problemSolving: 5,
        };
    }
    if (score >= 7.0) {
        return {
            scale: 5,
            independence: 4,
            creativity: 4,
            testingCode: 4,
            documenting: 3,
            speed: 4,
            thoroughness: 4,
            collaboration: 4,
            problemSolving: 4,
        };
    }
    if (score >= 5.0) {
        return {
            scale: 5,
            independence: 3,
            creativity: 3,
            testingCode: 3,
            documenting: 3,
            speed: 3,
            thoroughness: 3,
            collaboration: 3,
            problemSolving: 3,
        };
    }
    return {
        scale: 5,
        independence: 2,
        creativity: 2,
        testingCode: 2,
        documenting: 2,
        speed: 2,
        thoroughness: 2,
        collaboration: 2,
        problemSolving: 2,
    };
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company");
    const role = searchParams.get("role");
    const candidateId =
        searchParams.get("candidateId") ||
        searchParams.get("candidate") ||
        undefined;
    const format = (
        searchParams.get("format") ||
        searchParams.get("view") ||
        "json"
    ).toLowerCase();

    if (!company || !role) {
        return NextResponse.json(
            { error: "Missing required query params: company and role" },
            { status: 400 }
        );
    }

    const base = path.resolve(
        process.cwd(),
        "server/data/interviews",
        company,
        role
    );

    try {
        // Validate directory exists
        await fs.access(base);

        const candidatePromptPath = path.join(base, "candidatePrompt.txt");
        const jobDescriptionPath = path.join(base, "jobDescription.txt");
        const interviewScriptTxt = path.join(base, "interviewScript.txt");
        const interviewScriptMd = path.join(base, "interviewScript.md");
        const codingChallengePath = path.join(base, "codingChallenge.tsx");
        const codingChallengeAnswerPath = path.join(
            base,
            "codingChallengeAnswer.tsx"
        );

        const [prompt, jobDescription, codingChallenge, codingChallengeAnswer] =
            await Promise.all([
                readText(candidatePromptPath),
                readText(jobDescriptionPath),
                readText(codingChallengePath),
                readText(codingChallengeAnswerPath),
            ]);

        // interviewScript: support .txt or .md
        let interviewScript = "";
        try {
            interviewScript = await readText(interviewScriptTxt);
        } catch (_) {
            interviewScript = await readText(interviewScriptMd);
        }
        const questions = extractQuestions(interviewScript);

        // Candidate selection (deterministic list per company/role for now)
        const candidateList = createCandidates("");
        const selected = candidateId
            ? candidateList.find(
                  (c) => c.id.toLowerCase() === candidateId.toLowerCase()
              )
            : undefined;

        // Minimal profile fields (display name uses candidate if provided)
        const firstName = selected?.name?.split(/\s+/)[0] || "Candidate";
        let promptPersonalized = (prompt || "")
            .replace(/\bLarry\b/g, firstName)
            .replace(/\blarry\b/g, firstName.toLowerCase());
        // Inject level score dynamically if pattern exists, e.g., "Level 7.5/10"
        if (selected?.score) {
            promptPersonalized = promptPersonalized.replace(
                /(Level\s+)(\d+(?:\.\d+)?)(\/10)/i,
                `$1${selected.score}$3`
            );
        }
        const profile = {
            id: `${company}_${role}`,
            role: "candidate",
            name: `${company}_${role}`,
            displayName: selected?.name || "Candidate",
            placeholders: [
                "{{task_brief}}",
                "{{editor_content}}",
                "{{last_error}}",
            ],
            tools: {
                open_file: { returns: "{ content }" },
                write_file: {
                    params: ["content", "lineEdits"],
                    lineEditsSpec: {
                        op: "replace|insert|delete",
                        line: "number",
                        text: "string?",
                        position: "before|after?",
                    },
                },
            },
            characteristics: deriveCharacteristics(selected?.score || 5),
            prompt: promptPersonalized,
            jobDescription,
            interviewScript,
            codingChallenge,
            codingChallengeAnswer,
            questions,
            candidate: selected
                ? {
                      id: selected.id,
                      name: (selected as any).name,
                      tier: selected.tier,
                      score: selected.score,
                      // Map tiered subject-answers onto real interview questions by order
                      answers: (() => {
                          const subj = selected.answers || {};
                          const order = [
                              "complexReactIntegration",
                              "crossContextComm",
                              "secureValidation",
                              "prodDebug",
                              "perfMeasureImprove",
                              "globalState",
                              "renderOptimize",
                          ];
                          const mapped: Array<{
                              question: string;
                              answer: string;
                          }> = [];
                          for (
                              let i = 0;
                              i < Math.min(order.length, questions.length);
                              i++
                          ) {
                              const key = order[i] as keyof typeof subj;
                              mapped.push({
                                  question: questions[i],
                                  answer: (subj as any)[key],
                              });
                          }
                          return mapped;
                      })(),
                      code: selected.code,
                  }
                : undefined,
        } as any;

        const payload = {
            ok: true,
            company,
            role,
            candidateId: selected?.id,
            profile,
        };

        if (format === "html") {
            const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Interview Config · ${company}/${role}${
                selected?.id ? " · " + selected.id : ""
            }</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Inter, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; }
    .wrap { max-width: 920px; margin: 0 auto; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    .meta { color: #6b7280; margin-bottom: 16px; }
    pre { background: rgba(0,0,0,0.04); padding: 16px; border-radius: 10px; overflow: auto; line-height: 1.45; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; }
  </style>
  <script>
    const data = ${JSON.stringify(payload, null, 2)};
    window.__CONFIG__ = data;
  </script>
  </head>
  <body>
    <div class="wrap">
      <h1>Interview Configuration</h1>
      <div class="meta">Company: <strong>${company}</strong> · Role: <strong>${role}</strong>${
                selected?.id
                    ? ` · Candidate: <strong>${selected.id}</strong>`
                    : ""
            }</div>
      <pre><code id="json"></code></pre>
    </div>
    <script>
      document.getElementById('json').textContent = JSON.stringify(window.__CONFIG__, null, 2);
    </script>
  </body>
  </html>`;
            return new NextResponse(html, {
                status: 200,
                headers: { "Content-Type": "text/html; charset=utf-8" },
            });
        }

        return NextResponse.json(payload);
    } catch (e: any) {
        return NextResponse.json(
            {
                error:
                    e?.code === "ENOENT"
                        ? `Interview config not found for ${company}/${role}`
                        : String(e?.message || e),
            },
            { status: 404 }
        );
    }
}
