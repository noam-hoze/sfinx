import { NextRequest, NextResponse } from "next/server";
import { logger } from "app/shared/services";

export async function POST(request: NextRequest) {
    try {
        const { text, modelId } = await request.json();
        if (!text || typeof text !== "string") {
            return NextResponse.json(
                { error: "Missing text" },
                { status: 400 }
            );
        }

        const apiKey = process.env.ELEVENLABS_API_KEY;
        const voiceId = process.env.ELEVEN_LABS_CANDIDATE_VOICE_ID;
        if (!apiKey || !voiceId) {
            logger.error(
                "ElevenLabs TTS not configured (missing key or voice id)"
            );
            return NextResponse.json(
                { error: "TTS not configured" },
                { status: 500 }
            );
        }

        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
        const body = {
            text,
            model_id:
                modelId ||
                process.env.ELEVEN_LABS_TTS_MODEL_ID ||
                "eleven_monolingual_v1",
            voice_settings: {
                stability: 0.4,
                similarity_boost: 0.7,
            },
            optimize_streaming_latency: 1,
        } as any;

        const res = await fetch(url, {
            method: "POST",
            headers: {
                "xi-api-key": apiKey,
                "Content-Type": "application/json",
                Accept: "audio/mpeg",
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errText = await res.text();
            logger.error("ElevenLabs TTS error", errText);
            return NextResponse.json(
                { error: "TTS request failed", details: errText },
                { status: 500 }
            );
        }

        const arrayBuffer = await res.arrayBuffer();
        return new NextResponse(Buffer.from(arrayBuffer), {
            headers: {
                "Content-Type": "audio/mpeg",
                "Cache-Control": "no-store",
            },
        });
    } catch (e: any) {
        logger.error("TTS route error", e?.message || String(e));
        return NextResponse.json(
            { error: "TTS internal error" },
            { status: 500 }
        );
    }
}
