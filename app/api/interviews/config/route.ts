import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

async function readText(p: string) {
    return (await fs.readFile(p, "utf8")).trim();
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company");
    const role = searchParams.get("role");

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

        // Minimal profile fields (display name inferred from prompt header if needed)
        const profile = {
            id: `${company}_${role}`,
            role: "candidate",
            name: `${company}_${role}`,
            displayName: "Larry",
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
            characteristics: {
                independence: 4,
                creativity: 4,
                testingCode: 4,
                documenting: 3,
                speed: 4,
                thoroughness: 4,
                collaboration: 4,
                problemSolving: 4,
            },
            prompt,
            jobDescription,
            interviewScript,
            codingChallenge,
            codingChallengeAnswer,
        };

        return NextResponse.json({ ok: true, company, role, profile });
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
