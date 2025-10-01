import { z } from "zod";
import { logger } from "../logger";
import {
    GuidanceSchema,
    ScoringSchema,
    RespondRequestSchema,
    RespondRequest,
} from "./schema";
import { retrieveContext } from "./rag";
import { composePrompt } from "./prompt";

const log = logger.for("@digital-twin/orchestrator");

export async function runRespond(req: z.infer<typeof RespondRequestSchema>) {
    const startedAt = Date.now();
    const context = await retrieveContext(req);
    const prompt = composePrompt(req, context);

    // TODO: Replace with OpenAI client call. Using fetch to avoid adding deps.
    // Assumes OPENAI_API_KEY in env and responses in JSON mode when possible.
    const completion = await callOpenAI(prompt);

    const text = completion.text ?? "";
    const guidance = safeParse(GuidanceSchema, completion.guidance);
    const scoring = safeParse(ScoringSchema, completion.scoring);

    const traces = {
        tokens: completion.tokens ?? undefined,
        promptChars: prompt?.length ?? undefined,
        retrieved: context?.snippets?.length ?? 0,
        startedAt,
    };

    return { text, guidance, scoring, traces, safety: completion.safety ?? {} };
}

function safeParse<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
}

async function callOpenAI(prompt: string): Promise<any> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        log.warn("OPENAI_API_KEY missing; returning placeholder response");
        return {
            text: "Sorry, I cannot respond right now.",
            safety: { reason: "no_api_key" },
        };
    }

    // Minimal placeholder; replace with official SDK later.
    const body = {
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content:
                    "You are an interviewer twin. Use the respondWith tool to return your output. Do not answer outside tool calls.",
            },
            { role: "user", content: prompt },
        ],
        tools: [
            {
                type: "function",
                function: {
                    name: "respondWith",
                    description:
                        "Return the interviewer twin's structured response. All fields are required.",
                    parameters: {
                        type: "object",
                        properties: {
                            text: { type: "string" },
                            guidance: {
                                type: "object",
                                properties: {
                                    action: {
                                        type: "string",
                                        enum: [
                                            "ask_followup",
                                            "hint",
                                            "pace_up",
                                            "pace_down",
                                            "topic_shift",
                                            "end",
                                        ],
                                    },
                                    topic: { type: "string" },
                                    difficulty: {
                                        type: "string",
                                        enum: [
                                            "decrease",
                                            "maintain",
                                            "increase",
                                        ],
                                    },
                                    rationale: { type: "string" },
                                },
                                additionalProperties: false,
                                required: ["action", "rationale"],
                            },
                            scoring: {
                                type: "object",
                                properties: {
                                    scores: {
                                        type: "object",
                                        additionalProperties: {
                                            type: "number",
                                        },
                                    },
                                    confidence: {
                                        type: "number",
                                        minimum: 0,
                                        maximum: 1,
                                    },
                                    evidence: {
                                        type: "array",
                                        items: { type: "string" },
                                    },
                                },
                                additionalProperties: false,
                            },
                        },
                        required: ["text", "guidance", "scoring"],
                        additionalProperties: false,
                    },
                },
            },
        ],
        tool_choice: { type: "function", function: { name: "respondWith" } },
        temperature: 0.4,
    } as any;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text();
        log.error("OpenAI error", { status: res.status, text });
        return {
            text: "",
            safety: { reason: "openai_error", status: res.status },
        };
    }

    const data = await res.json();
    const message = data?.choices?.[0]?.message;
    const toolCall = message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
        try {
            const args = JSON.parse(toolCall.function.arguments);
            // Validate with Zod to ensure typed JSON
            const argsSchema = z
                .object({
                    text: z.string(),
                    guidance: GuidanceSchema,
                    scoring: ScoringSchema,
                })
                .strict();
            const parsed = argsSchema.safeParse(args);
            if (parsed.success) {
                return parsed.data;
            }
            return { text: args?.text ?? "" };
        } catch {
            return { text: "" };
        }
    }
    const content = message?.content ?? "";
    return { text: content };
}
