import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { buildCandidatePrompt } from "app/shared/services/candidatePrompt";

const RangeSchema = z
    .object({
        start: z.number().int().nonnegative(),
        end: z.number().int().nonnegative(),
    })
    .refine((r) => r.start <= r.end, {
        message: "range.start must be <= range.end",
    });

const CodeEditSchema = z.object({
    file: z.string().min(1),
    range: RangeSchema,
    replacement: z.string(),
});

const ContextSchema = z.object({
    file: z.string(),
    versionId: z.string(),
    beforeHash: z.string(),
    text: z.string().optional(),
    slices: z
        .array(
            z.object({
                range: RangeSchema,
                text: z.string(),
            })
        )
        .optional(),
    outline: z.string().optional(),
});

const ControlsSchema = z.object({
    maxEdits: z.number().int().positive().optional(),
    maxEditSize: z.number().int().positive().optional(),
    allowMultiFile: z.boolean().optional(),
    allowCodeEdits: z.boolean().optional(),
});

const RequestSchema = z.object({
    context: ContextSchema,
    history: z
        .array(
            z.object({
                role: z.enum(["candidate", "interviewer"]).optional(),
                text: z.string(),
            })
        )
        .default([]),
    controls: ControlsSchema.optional(),
    transcript: z.string().optional(),
    respondWithCandidate: z
        .object({
            text: z.string().optional(),
            codeEdits: z.array(CodeEditSchema).default([]),
        })
        .default({ codeEdits: [] }),
});

function containsCodeLikeText(text: string): boolean {
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

export async function POST(request: NextRequest) {
    // Auth: restrict to COMPANY and ADMIN (training usage)
    const session = (await getServerSession(authOptions)) as any;
    const role = session?.user?.role as string | undefined;
    if (!session || (role !== "ADMIN" && role !== "COMPANY")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const parsed = RequestSchema.safeParse(json);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid request", issues: parsed.error.issues },
            { status: 400 }
        );
    }

    const { controls, respondWithCandidate, transcript } = parsed.data;

    // Enforce: only allow codeEdits when explicitly allowed
    if (
        respondWithCandidate.codeEdits.length > 0 &&
        controls?.allowCodeEdits !== true
    ) {
        return NextResponse.json(
            { error: "Code edits not allowed in current phase" },
            { status: 400 }
        );
    }

    // Enforce: never include code in `text`
    if (
        respondWithCandidate.text &&
        containsCodeLikeText(respondWithCandidate.text)
    ) {
        return NextResponse.json(
            { error: "Text must not contain code" },
            { status: 400 }
        );
    }

    // Enforce: maxEditSize if provided
    if (controls?.maxEditSize) {
        const tooLarge = respondWithCandidate.codeEdits.find(
            (e) => e.replacement.length > controls.maxEditSize!
        );
        if (tooLarge) {
            return NextResponse.json(
                { error: "Edit exceeds maxEditSize" },
                { status: 400 }
            );
        }
    }

    // If codeEdits provided and allowed, return them unchanged (edit path)
    if (respondWithCandidate.codeEdits.length > 0) {
        return NextResponse.json({ ok: true, respondWithCandidate });
    }

    // Otherwise, synthesize reply from a model if available; fall back to heuristic
    const input = (transcript || respondWithCandidate.text || "").trim();
    const reply = await generateCandidateReply(
        input,
        parsed.data.history || []
    );
    return NextResponse.json({
        ok: true,
        respondWithCandidate: { text: reply, codeEdits: [] },
    });
}

async function generateCandidateReply(
    input: string,
    history: Array<{ role?: "candidate" | "interviewer"; text: string }>
): Promise<string> {
    const key = process.env.OPENAI_API_KEY;
    try {
        // Build prompt per CANDIDATE_SIMULATION.md
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
            []
        );
        const system = `${prompt.system}\nPersona: ${
            prompt.persona
        }\nRules:\n- ${prompt.behaviorRules.join("\n- ")}`;
        const messages: any[] = [{ role: "system", content: system }];
        for (const h of history) {
            if (!h?.text) continue;
            messages.push({
                role: h.role === "candidate" ? "assistant" : "user",
                content: h.text,
            });
        }
        if (input) messages.push({ role: "user", content: input });

        if (key) {
            const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
            const res = await fetch(
                "https://api.openai.com/v1/chat/completions",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${key}`,
                    },
                    body: JSON.stringify({
                        model,
                        temperature: 0.6,
                        max_tokens: 120,
                        messages,
                    }),
                }
            );
            const json: any = await res.json();
            const text: string | undefined =
                json?.choices?.[0]?.message?.content?.trim();
            if (text && !containsCodeLikeText(text)) return text;
        }
    } catch {}
    return simpleCandidateReply(input);
}

function simpleCandidateReply(input: string): string {
    const lower = input.toLowerCase();
    if (/(hello|hi|hey)\b/.test(lower)) return "Hi! Ready when you are.";
    if (/how are you\b/.test(lower)) return "Doing well and ready to proceed.";
    if (/start|begin/.test(lower)) return "Okay, I’ll get started.";
    if (/explain|why/.test(lower)) return "Sure—here’s my reasoning.";
    return "Understood. I’ll proceed accordingly.";
}
