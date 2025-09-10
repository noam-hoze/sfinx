import { NextResponse } from "next/server";
import { logger } from "../../../services";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const customAgentId = searchParams.get("agentId");

        const agentId = customAgentId || process.env.NEXT_PUBLIC_AGENT_ID;

        logger.info("Test signed URL - Agent ID:", agentId);
        logger.info(
            "Test signed URL - Custom agent ID provided:",
            !!customAgentId
        );
        logger.info(
            "ELEVENLABS_API_KEY present:",
            !!process.env.ELEVENLABS_API_KEY
        );

        if (!agentId) {
            logger.error("No agent ID available!");
            return NextResponse.json(
                { error: "Agent ID not configured" },
                { status: 500 }
            );
        }

        if (!process.env.ELEVENLABS_API_KEY) {
            logger.error("ELEVENLABS_API_KEY is not set!");
            return NextResponse.json(
                { error: "API key not configured" },
                { status: 500 }
            );
        }

        const url = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`;
        logger.info("Test - Fetching URL:", url);

        const response = await fetch(url, {
            headers: {
                "xi-api-key": process.env.ELEVENLABS_API_KEY,
            },
        });

        logger.info("Test - ElevenLabs API response status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            logger.error("Test - ElevenLabs API error response:", errorText);
            throw new Error(
                `ElevenLabs API returned ${response.status}: ${errorText}`
            );
        }

        const data = await response.json();
        logger.info("Test - ElevenLabs API response data:", data);

        if (!data.signed_url) {
            logger.error("Test - No signed_url in response");
            throw new Error("Invalid response from ElevenLabs API");
        }

        return NextResponse.json({
            signedUrl: data.signed_url,
            agentId: agentId,
            usedCustomAgent: !!customAgentId,
        });
    } catch (error) {
        logger.error("Test - Error in convai:", error);
        return NextResponse.json(
            {
                error: "Failed to generate signed URL",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
