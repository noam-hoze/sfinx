import { NextRequest, NextResponse } from "next/server";
import { logger } from "app/shared/services";

export async function POST(request: NextRequest) {
    try {
        const { text, voice, format } = await request.json();
        if (!text || typeof text !== "string") {
            return NextResponse.json(
                { error: "Missing text" },
                { status: 400 }
            );
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            logger.error("OPENAI_API_KEY not configured for TTS");
            return NextResponse.json(
                { error: "TTS not configured" },
                { status: 500 }
            );
        }

        const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
        const voiceId = voice || process.env.OPENAI_TTS_VOICE || "alloy";
        const audioFormat = format || "mp3";

        const res = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                voice: voiceId,
                input: text,
                format: audioFormat,
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            logger.error("OpenAI TTS error", errText);
            return NextResponse.json(
                { error: "TTS request failed", details: errText },
                { status: 500 }
            );
        }

        const arrayBuffer = await res.arrayBuffer();
        return new NextResponse(Buffer.from(arrayBuffer), {
            headers: {
                "Content-Type":
                    audioFormat === "wav" ? "audio/wav" : "audio/mpeg",
                "Cache-Control": "no-store",
            },
        });
    } catch (e: any) {
        logger.error("OpenAI TTS route error", e?.message || String(e));
        return NextResponse.json(
            { error: "TTS internal error" },
            { status: 500 }
        );
    }
}
