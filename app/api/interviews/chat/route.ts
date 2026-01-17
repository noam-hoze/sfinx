import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.OPENAI;

const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

/**
 * POST /api/interviews/chat
 * Handles all OpenAI chat interactions: persona setup, question generation, and follow-ups
 */
export async function POST(request: NextRequest) {
    const requestId = request.headers.get("x-request-id");
    try {
        const body = await request.json();
        const { persona, instruction, conversationHistory } = body;

        if (!persona) {
            return NextResponse.json(
                { error: "Missing persona" },
                { status: 400 }
            );
        }

        const conversationTurnCount = Array.isArray(conversationHistory) ? conversationHistory.length : undefined;
        log.info(LOG_CATEGORY, "[chat] OpenAI request prepared", {
            requestId,
            hasInstruction: Boolean(instruction),
            conversationTurnCount,
            personaLength: persona.length,
            instructionLength: instruction ? instruction.length : undefined,
            model: "gpt-4o-mini",
        });

        let messages;
        if (conversationHistory && conversationHistory.length > 0) {
            // Chat completion with history
            messages = [{ role: "system", content: persona }, ...conversationHistory];
        } else if (instruction) {
            // Assistant reply generation
            messages = [
                { role: "system", content: persona },
                { role: "user", content: instruction },
            ];
        } else {
            return NextResponse.json(
                { error: "Must provide either instruction or conversationHistory" },
                { status: 400 }
            );
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: instruction ? 0 : 0.2,
            messages,
        });

        const result = completion.choices?.[0]?.message?.content?.trim();

        log.info(LOG_CATEGORY, "[chat] OpenAI response received", {
            requestId,
            responseLength: result ? result.length : undefined,
        });

        if (!result) {
            throw new Error("OpenAI returned empty response");
        }

        return NextResponse.json({ response: result });
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[chat] OpenAI request failed", {
            requestId,
            errorMessage: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: error.message || "Failed to generate question" },
            { status: 500 }
        );
    }
}
