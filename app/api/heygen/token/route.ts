import { NextResponse } from "next/server";

export async function GET() {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
        return NextResponse.json(
            { error: "Missing HEYGEN_API_KEY" },
            { status: 500 }
        );
    }

    // 1) Ask HeyGen for a streaming session token
    console.log(
        "Making request to HeyGen with API key:",
        apiKey ? "present" : "missing"
    );

    const r = await fetch("https://api.heygen.com/v1/streaming.new", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            quality: "high",
            avatar_name: "Katya_Black_Suit_public",
        }),
    });

    console.log("HeyGen response status:", r.status);
    const data = await r.json();
    console.log("HeyGen response data:", data);
    console.log("HeyGen response keys:", Object.keys(data || {}));

    if (!r.ok) {
        console.log("HeyGen API error:", data);
        return NextResponse.json(
            { error: data?.message || "Failed to create token", details: data },
            { status: r.status }
        );
    }

    // HeyGen returns data in a nested structure: { code, data: { ... }, message }
    if (data?.code === 100 && data?.data) {
        console.log("HeyGen session created successfully");
        const sessionData = data.data;

        // If access_token is null, we might need to use session_id as the token
        const accessToken = sessionData.access_token || sessionData.session_id;
        const sessionId = sessionData.session_id;

        if (!accessToken) {
            return NextResponse.json(
                {
                    error: "No access token or session ID in HeyGen response",
                    details: data,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            access_token: accessToken,
            session_id: sessionId,
            sdp: sessionData.sdp,
            url: sessionData.url,
        });
    }

    // Fallback for unexpected response format
    return NextResponse.json(
        { error: "Unexpected HeyGen response format", details: data },
        { status: 500 }
    );
}
