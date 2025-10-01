import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const { text, voiceId } = await request.json();
        if (!text || typeof text !== "string") {
            return NextResponse.json(
                { error: "Invalid text" },
                { status: 400 }
            );
        }

        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "ELEVENLABS_API_KEY not set" },
                { status: 500 }
            );
        }

        const resolvedVoiceId =
            voiceId || process.env.ELEVEN_LABS_INTERVIEWER_VOICE_ID;
        const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${
            resolvedVoiceId || "21m00Tcm4TlvDq8ikWAM"
        }`;

        const res = await fetch(endpoint, {
            method: "POST",
            headers: {
                "xi-api-key": apiKey,
                "Content-Type": "application/json",
                Accept: "audio/mpeg",
            },
            body: JSON.stringify({
                text,
                model_id: "eleven_multilingual_v2",
                voice_settings: { stability: 0.4, similarity_boost: 0.7 },
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            return NextResponse.json(
                { error: "TTS failed", details: errText },
                { status: 500 }
            );
        }

        const arrayBuffer = await res.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const dataUrl = `data:audio/mpeg;base64,${base64}`;
        return NextResponse.json({ audioUrl: dataUrl, mime: "audio/mpeg" });
    } catch (error: any) {
        return NextResponse.json(
            { error: "Internal error", details: error?.message },
            { status: 500 }
        );
    }
}
