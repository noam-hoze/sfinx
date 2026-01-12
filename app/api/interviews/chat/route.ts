import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

/**
 * POST /api/interviews/chat
 * Handles all OpenAI chat interactions: persona setup, question generation, and follow-ups
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { persona, instruction, conversationHistory } = body;

        if (!persona) {
            return NextResponse.json(
                { error: "Missing persona" },
                { status: 400 }
            );
        }

        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("→ OpenAI Request [chat" + (instruction ? " - initial setup" : " - follow-up") + "]");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("Model: gpt-4o-mini");
        console.log("\nPersona (System):", persona);
        if (instruction) {
            console.log("\nInstruction:", instruction);
        }
        if (conversationHistory && conversationHistory.length > 0) {
            console.log("\nConversation History:");
            console.log(JSON.stringify(conversationHistory, null, 2));
        }

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

        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("← OpenAI Response [generate-question]");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(result);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

        if (!result) {
            throw new Error("OpenAI returned empty response");
        }

        return NextResponse.json({ response: result });
    } catch (error: any) {
        console.error("[generate-question] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate question" },
            { status: 500 }
        );
    }
}
