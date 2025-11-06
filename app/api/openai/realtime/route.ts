import { NextRequest, NextResponse } from "next/server";

// POST /api/openai/realtime
// Returns an ephemeral client secret for OpenAI Realtime API
export async function POST(_req: NextRequest) {
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
        return NextResponse.json(
            { error: "Missing NEXT_PUBLIC_OPENAI_API_KEY" },
            { status: 500 }
        );
    }

    try {
        const res = await fetch(
            "https://api.openai.com/v1/realtime/client_secrets",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    session: {
                        type: "realtime",
                        model: "gpt-4o-realtime-preview-2024-12-17",
                    },
                }),
            }
        );

        if (!res.ok) {
            const text = await res.text();
            return NextResponse.json(
                { error: "Failed to mint client secret", details: text },
                { status: 500 }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json(
            { error: "Unexpected error", details: String(err?.message || err) },
            { status: 500 }
        );
    }
}
