import { buildCandidatePrompt } from "./candidatePrompt";

export type CandidateHistoryTurn = {
    role?: "candidate" | "interviewer";
    text: string;
};

export type CandidateContext = {
    file: string;
    versionId: string;
    beforeHash: string;
    text?: string;
    slices?: Array<{ range: { start: number; end: number }; text: string }>;
    outline?: string;
};

export type CodeEdit = {
    file: string;
    range: { start: number; end: number };
    replacement: string;
};

export function containsCodeLikeText(text: string): boolean {
    const forbidden = [
        /```/,
        /`/,
        /\bfunction\b/,
        /\bconst\b/,
        /\blet\b/,
        /<\w+>/,
    ];
    return forbidden.some((re) => re.test(text));
}

function sanitizeSpokenText(text: string): string {
    let sanitized = text.replace(/```[\s\S]*?```/g, "[code omitted]");
    sanitized = sanitized.replace(/`([^`]+)`/g, "$1");
    return sanitized;
}

function preview(text: string, max = 180): string {
    const t = text ?? "";
    return t.length <= max ? t : t.slice(0, max) + "…";
}

function summarizeMessages(messages: Array<{ role: string; content: string }>) {
    return messages.map((m, i) => ({
        idx: i,
        role: m.role,
        len: m.content?.length || 0,
        preview: preview(m.content || "", 200),
    }));
}

export async function generateCandidateReply(
    input: string,
    history: Array<CandidateHistoryTurn>,
    context?: CandidateContext
): Promise<string> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
        return "System error: OpenAI API key is not configured.";
    }
    try {
        const prompt = buildCandidatePrompt(
            {
                independent: 70,
                creative: 60,
                resilient: 70,
                testingRigor: 50,
                documentationRigor: 40,
                pragmatism: 65,
                riskAversion: 30,
                pace: 75,
                verbosity: 35,
            },
            [],
            {
                companyName: "Meta",
                roleTitle: "Senior Frontend Engineer",
                productArea: "Core Product",
                primaryStack: ["React", "TypeScript", "Next.js"],
                candidateName: "Larry",
            }
        );
        const system = `${prompt.system}\nPersona: ${
            prompt.persona
        }\nRules:\n- ${prompt.behaviorRules.join("\n- ")}`;
        const messages: any[] = [{ role: "system", content: system }];
        const fileName = context?.file || "";
        const codeText = (context?.text || "").slice(0, 4000);
        if (codeText) {
            const codeContext = `You can reference the current editor file if relevant. Do not recite large code unless explicitly asked.\nFile: ${
                fileName || "(unknown)"
            }\n----- BEGIN CURRENT FILE TEXT -----\n${codeText}\n----- END CURRENT FILE TEXT -----`;
            messages.push({ role: "user", content: codeContext });
        }
        for (const h of history) {
            if (!h?.text) continue;
            messages.push({
                role: h.role === "candidate" ? "assistant" : "user",
                content: h.text,
            });
        }
        if (input) messages.push({ role: "user", content: input });

        const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
        console.info("@openai.chat request (reply)", {
            model,
            messages: summarizeMessages(messages as any),
        });
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
                model,
                temperature: 0.3,
                max_tokens: 140,
                messages,
            }),
        });
        const json: any = await res.json();
        const text: string | undefined =
            json?.choices?.[0]?.message?.content?.trim();
        if (text) {
            if (containsCodeLikeText(text)) {
                console.warn("Chat reply contained code-like text", {
                    sample: text.slice(0, 160),
                });
                return sanitizeSpokenText(text);
            }
            return text;
        }
    } catch (e: any) {
        console.error("generateCandidateReply error", e);
        const message = typeof e?.message === "string" ? e.message : String(e);
        return `System error generating reply: ${message}`;
    }
    return "System error: empty response from model.";
}

// Removed hardcoded fallback; rely on richer persona/prompt for natural responses

export async function generateCodeEdits(
    context: CandidateContext,
    history: Array<CandidateHistoryTurn> = [],
    task?: string,
    plan?: string
): Promise<Array<CodeEdit>> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return [] as any;
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const currentFile = context?.file || "file.tsx";
    const currentText = context?.text || "";
    const taskLine =
        task && task.trim().length > 0
            ? `TASK: ${task.trim()}`
            : `TASK: Implement the most recent interviewer request based on prior chat history.`;
    const planLine =
        plan && plan.trim().length > 0 ? `PLAN: ${plan.trim()}` : "";
    const recent = history.slice(-12);
    const historyBlock =
        recent.length > 0
            ? `RECENT CONVERSATION (most recent last)\n` +
              recent
                  .map(
                      (t) =>
                          `${
                              t.role === "candidate"
                                  ? "Candidate"
                                  : "Interviewer"
                          }: ${t.text}`
                  )
                  .join("\n")
            : "";
    const prompt = `You edit a single file in-place. Return ONLY JSON with codeEdits matching:
{
  "codeEdits": [
    { "file": "${currentFile}", "range": { "start": number, "end": number }, "replacement": string }
  ]
}
Constraints:
- No fields other than codeEdits.
- Ranges are zero-based character indices into CURRENT FILE TEXT below.
- If no change, return {"codeEdits": []}.

${taskLine}
${planLine}

${historyBlock}

CURRENT FILE TEXT START\n${currentText}\nCURRENT FILE TEXT END`;
    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
                model,
                temperature: 0.2,
                max_tokens: 300,
                // Strongly enforce JSON output from the model
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content:
                            "Return ONLY valid JSON per the schema. No prose.",
                    },
                    { role: "user", content: prompt },
                ],
            }),
        });
        console.info("@openai.chat request (code)", {
            model,
            task: preview(taskLine, 200),
            plan: preview(planLine, 200),
            historyCount: recent.length,
            promptPreview: preview(prompt, 400),
            promptLen: prompt.length,
        });
        const json: any = await res.json();
        const content = json?.choices?.[0]?.message?.content || "";
        let parsed: any = null;
        try {
            parsed = JSON.parse(content);
        } catch (e) {
            // Log and bail with empty edits on malformed JSON
            console.warn("codeEdits JSON parse failed", {
                sample: content.slice(0, 200),
            });
            return [] as any;
        }
        const arr: any[] = Array.isArray(parsed?.codeEdits)
            ? parsed.codeEdits
            : [];
        const safe = arr.filter(
            (e) =>
                e &&
                typeof e.file === "string" &&
                e.range &&
                Number.isInteger(e.range.start) &&
                Number.isInteger(e.range.end) &&
                typeof e.replacement === "string"
        );
        return safe as any;
    } catch (e) {
        console.warn("generateCodeEdits failed", e);
    }
    return [] as any;
}
