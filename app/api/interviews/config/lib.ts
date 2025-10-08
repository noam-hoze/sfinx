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
        if (/^\s*-{3,}\s*$/.test(line) || /^##+\s/.test(line)) break;
        const m = /^\*\s+(.*)$/.exec(line);
        if (m && m[1]) qs.push(m[1].trim());
    }
    return qs;
}

function deriveCharacteristics(score: number) {
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

export async function buildInterviewConfigs(params: {
    company: string;
    roleRaw: string;
    candidateId?: string;
}) {
    const { company, roleRaw, candidateId } = params;

    const roleSlug = roleRaw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    const roleAliases: Record<string, string> = {
        "frontend-engineer": "frontend-developer",
        "front-end-engineer": "frontend-developer",
        "front-end-developer": "frontend-developer",
    };
    const role = roleAliases[roleSlug] || roleSlug;

    const base = path.resolve(
        process.cwd(),
        "server/data/interviews",
        company,
        role
    );
    await fs.access(base);

    const candidatePromptPath = path.join(base, "candidatePrompt.txt");
    const jobDescriptionPath = path.join(base, "jobDescription.txt");
    const interviewScriptJson = path.join(base, "interviewScript.json");
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

    let interviewScript = "";
    let interviewScriptJSON: any | null = null;
    try {
        const raw = await readText(interviewScriptJson);
        interviewScriptJSON = JSON.parse(raw);
    } catch (_) {
        try {
            interviewScript = await readText(interviewScriptTxt);
        } catch (_) {
            interviewScript = await readText(interviewScriptMd);
        }
    }
    const questions =
        interviewScriptJSON?.questions || extractQuestions(interviewScript);

    const candidateList = createCandidates("");
    const selected = candidateId
        ? candidateList.find(
              (c) => c.id.toLowerCase() === candidateId.toLowerCase()
          )
        : undefined;

    const firstName = selected?.name?.split(/\s+/)[0] || "Candidate";
    let promptPersonalized = (prompt || "")
        .replace(/\bLarry\b/g, firstName)
        .replace(/\blarry\b/g, firstName.toLowerCase());
    if (selected?.score) {
        promptPersonalized = promptPersonalized.replace(
            /(Level\s+)(\d+(?:\.\d+)?)(\/10)/i,
            `$1${selected.score}$3`
        );
    }

    const profile: any = {
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
    };

    // Build interviewer prompt
    let interviewerPrompt = "";
    let followupOnDoneTemplate = "";
    try {
        const perRolePromptPath = path.resolve(
            process.cwd(),
            "server/data/interviews",
            company,
            role,
            "interviewer.prompt.json"
        );
        const basePromptPath = path.resolve(
            process.cwd(),
            "server/data/interviews/prompts/interviewer.base.json"
        );
        let promptJsonRaw = "";
        try {
            promptJsonRaw = await readText(perRolePromptPath);
        } catch (_) {
            promptJsonRaw = await readText(basePromptPath);
        }
        const promptJson = JSON.parse(promptJsonRaw);
        const codingPrompt = interviewScriptJSON?.codingChallenge?.prompt || "";
        const firstQuestion = questions[0] || "";

        const lines: string[] = [];
        if (promptJson.personality) {
            const personality = String(promptJson.personality).replace(
                /\{\{\s*company_name\s*\}\}/g,
                company
            );
            lines.push("# Personality", "", personality, "");
        }
        if (promptJson.environment) {
            lines.push("# Environment", "", promptJson.environment, "");
        }
        if (promptJson.tone && Array.isArray(promptJson.tone)) {
            lines.push(
                "# Tone",
                "",
                ...promptJson.tone.map((t: string) => `-   ${t}`),
                ""
            );
        }
        if (promptJson.goal) {
            lines.push("# Goal", "", promptJson.goal, "");
        }
        lines.push("# Interview Flow", "");
        lines.push(
            "1. Greeting (one line): “Hi {{candidate_name}}, nice to meet you.”"
        );
        const taskTextWithSuffix =
            "Create a React component where a simulated child frame sends analytics events to the parent app using postMessage. Feel free to ask me anything you want. Let's start!";
        if (firstQuestion) {
            lines.push(`2. Background question (one line): "${firstQuestion}"`);
        }
        if (promptJson.flow?.preCoding) {
            lines.push(promptJson.flow.preCoding.replace(/^/, "3. "));
        } else {
            lines.push(
                "3. Before coding ({{is_coding}} is false): respond normally to meaningful questions (≤2 sentences)."
            );
            lines.push(
                "If the candidate asks about you, or about the company answer him."
            );
        }
        lines.push(
            `4. If {{is_in_coding_question}} is true: “${taskTextWithSuffix}”`
        );
        lines.push(
            "5. During coding ({{is_coding}} is true):",
            "    - If {{using_ai}} is false:",
            "        - Default is silence; never initiate.",
            "        - Respond only to direct, meaningful messages from the candidate.",
            "        - Ignore noise/ellipses/filler/punctuation-only; produce no output."
        );
        const closingLine =
            promptJson.flow?.closing?.closingLine ||
            "Thank you so much {{candidate_name}}, the next steps will be shared with you shortly.";
        const triggerPhrase =
            promptJson.flow?.closing?.triggerPhrase ||
            "I'm done. Please say your closing line and then end the connection";
        lines.push(
            `6. DO NOT SAY THE CLOSING LINE UNLESS you got a message from the user which contains the text: "${triggerPhrase}". Then and only then you will say "${closingLine}"; never repeat your closing line.`
        );
        interviewerPrompt = lines.join("\n");
        followupOnDoneTemplate = promptJson.templates?.followupOnDone || "";
    } catch (_) {
        interviewerPrompt = "";
    }

    if (!followupOnDoneTemplate) {
        followupOnDoneTemplate = `Don't answer this message in our voice conversation. It's just to inform you of something.\nThe candidate clicked "I'm Done" after new edits. Now your followup_ready variable is\ntrue. Ask the candidate one follow up question about: {{followup_delta}}. Then you have to wait for his answer. \nIgnore noise and any other non lingual messages.\nAfter the user answers, you will reply with an acknowledgemet and that's it. You will not ask another followup question.\nAfter that, you go back to listening. Don't say your closing line`;
    }

    const candidateConfig = {
        profile,
        codingChallenge,
        codingChallengeAnswer,
        candidate: profile.candidate,
    };

    const interviewerConfig = {
        interviewerPrompt,
        promptTemplates: {
            followupOnDone: { template: followupOnDoneTemplate },
        },
    };

    return {
        company,
        role,
        candidateId: profile.candidate?.id as string | undefined,
        profile,
        interviewerPrompt,
        promptTemplates: interviewerConfig.promptTemplates,
        codingChallenge,
        codingChallengeAnswer,
        candidateConfig,
        interviewerConfig,
    };
}
