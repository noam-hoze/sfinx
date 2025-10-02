import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
    CandidateRespondRequestSchema,
    CandidateEditSchema,
} from "app/shared/services/digital-twin/schema";
import { logger } from "app/shared/services";

const log = logger.for("@api/digital-twin/candidate");

export async function POST(request: NextRequest) {
    try {
        const json = await request.json();
        const parsed = CandidateRespondRequestSchema.safeParse(json);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid request", issues: parsed.error.issues },
                { status: 400 }
            );
        }

        const { text, codeEdits } = await callOpenAIForCandidate(parsed.data);

        // Validate edits against schema for safety
        const edits = (codeEdits || [])
            .map((e: unknown) => CandidateEditSchema.safeParse(e))
            .filter((r: any) => r.success)
            .map((r: any) => r.data);

        return NextResponse.json({ text: text || "", codeEdits: edits });
    } catch (error: any) {
        log.error("/candidate failed", { message: error?.message });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

async function callOpenAIForCandidate(
    body: z.infer<typeof CandidateRespondRequestSchema>
): Promise<{ text?: string; codeEdits?: any[] }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        log.warn(
            "OPENAI_API_KEY missing; returning placeholder candidate response"
        );
        return { text: "I will make a small change.", codeEdits: [] };
    }

    const system = [
        "You are the candidate in a coding interview.",
        "Speak briefly and naturally in text.",
        "All code modifications MUST be returned only via the respondWithCandidate tool as codeEdits.",
        "Never include code in spoken text; keep code only in codeEdits.",
    ].join("\n");

    const contextStr = formatContext(body);

    const req = {
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: system },
            { role: "user", content: contextStr },
        ],
        tools: [
            {
                type: "function",
                function: {
                    name: "respondWithCandidate",
                    description: "Return the candidate reply and code edits.",
                    parameters: {
                        type: "object",
                        properties: {
                            text: { type: "string" },
                            codeEdits: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        file: { type: "string" },
                                        range: {
                                            type: "object",
                                            properties: {
                                                start: {
                                                    type: "number",
                                                    minimum: 0,
                                                },
                                                end: {
                                                    type: "number",
                                                    minimum: 0,
                                                },
                                            },
                                            required: ["start", "end"],
                                            additionalProperties: false,
                                        },
                                        replacement: { type: "string" },
                                    },
                                    required: ["file", "range", "replacement"],
                                    additionalProperties: false,
                                },
                            },
                        },
                        required: ["codeEdits"],
                        additionalProperties: false,
                    },
                },
            },
        ],
        tool_choice: {
            type: "function",
            function: { name: "respondWithCandidate" },
        },
        temperature: 0.3,
    } as any;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(req),
    });

    if (!res.ok) {
        const errText = await res.text();
        log.error("candidate openai error", { status: res.status, errText });
        return { text: "", codeEdits: [] };
    }
    const data = await res.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
        try {
            const args = JSON.parse(toolCall.function.arguments);
            return { text: args?.text, codeEdits: args?.codeEdits };
        } catch {
            return { text: "", codeEdits: [] };
        }
    }
    const content = data?.choices?.[0]?.message?.content ?? "";
    return { text: content, codeEdits: [] };
}

function formatContext(
    body: z.infer<typeof CandidateRespondRequestSchema>
): string {
    const lines: string[] = [];
    lines.push(`FILE: ${body.context.file}`);
    lines.push(
        `VERSION: ${body.context.versionId} HASH: ${body.context.beforeHash}`
    );
    if (body.context.text) {
        lines.push(
            "BEGIN_CODE\n" + body.context.text.slice(0, 6000) + "\nEND_CODE"
        );
    }
    if (body.history?.length) {
        lines.push(
            "HISTORY:\n" +
                body.history
                    .slice(-6)
                    .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
                    .join("\n")
        );
    }
    lines.push(
        "Return respondWithCandidate with concise text and precise codeEdits."
    );
    return lines.join("\n\n");
}
