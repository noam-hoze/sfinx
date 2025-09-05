import { NextResponse } from "next/server";

function validateRequest(code: any) {
    if (!code) {
        return NextResponse.json(
            { error: "No code provided" },
            { status: 400 }
        );
    }

    if (!process.env.ELEVENLABS_API_KEY || !process.env.NEXT_PUBLIC_AGENT_ID) {
        console.error("Eleven Labs configuration missing");
        return NextResponse.json(
            { error: "Configuration error" },
            { status: 500 }
        );
    }

    return null; // Valid
}

export async function POST(request: Request) {
    try {
        const { code } = await request.json();

        const validationError = validateRequest(code);
        if (validationError) return validationError;

        // Send to Eleven Labs and validate response
        const response = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversation/send-message`,
            {
                method: "POST",
                headers: {
                    "xi-api-key": process.env.ELEVENLABS_API_KEY!,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    agent_id: process.env.NEXT_PUBLIC_AGENT_ID!,
                    message: `Code Update: ${code}`,
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Eleven Labs API error:", response.status, errorText);
            return NextResponse.json(
                { error: "Failed to send to Eleven Labs" },
                { status: response.status }
            );
        }

        const result = await response.json();
        console.log("✅ Code successfully sent to Eleven Labs agent");

        return NextResponse.json({
            success: true,
            message: "Code sent to interviewer",
            elevenLabsResponse: result,
        });
    } catch (error) {
        console.error("❌ Error sending code to Eleven Labs:", error);
        return NextResponse.json({ error: "Network error" }, { status: 500 });
    }
}
