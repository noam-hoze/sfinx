import { NextResponse } from "next/server";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const AGENT_ID =
    process.env.NEXT_PUBLIC_AGENT_ID || "agent_01jzdt18pxf3ebb27sad40cwe4";

export async function GET() {
    const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${AGENT_ID}`,
        { headers: { "xi-api-key": ELEVENLABS_API_KEY } }
    );

    if (!response.ok) {
        return NextResponse.json(
            { error: await response.text() },
            { status: 500 }
        );
    }

    const data = await response.json();
    console.log("Fresh signed URL response:", data);

    return NextResponse.json({ url: data.url || data.signed_url });
}
