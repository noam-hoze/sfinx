import { NextRequest, NextResponse } from "next/server";

// Eleven Labs API configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";
const ELEVENLABS_CONVERSATIONAL_URL = "https://api.elevenlabs.io";

// ElevenLabs Conversational AI Agent ID
const CONVERSATION_AGENT_ID = "agent_01jzdt18pxf3ebb27sad40cwe4";

export async function POST(request: NextRequest) {
    try {
        const { message, conversation_id } = await request.json();

        if (!message) {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400 }
            );
        }

        if (!ELEVENLABS_API_KEY) {
            console.error("ELEVENLABS_API_KEY is not set");
            return NextResponse.json(
                { error: "ElevenLabs API key not configured" },
                { status: 500 }
            );
        }

        // Call ElevenLabs Conversational AI API
        console.log(
            "Making request to ElevenLabs with agent:",
            CONVERSATION_AGENT_ID
        );
        console.log("API Key present:", !!ELEVENLABS_API_KEY);

        const url = `${ELEVENLABS_CONVERSATIONAL_URL}/v1/convai/agents/${CONVERSATION_AGENT_ID}/simulate-conversation`;
        const payload = {
            messages: [
                ...(conversation_id
                    ? [
                          {
                              role: "system",
                              content: `conversation_id:${conversation_id}`,
                          },
                      ]
                    : []),
                { role: "user", content: message },
            ],
            simulation_specification: {
                type: "text",
                simulated_user_config: {
                    name: "User",
                },
            },
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        // Debug logs (can be removed in production)
        console.log("ElevenLabs response status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("ElevenLabs API error:", response.status, errorText);
            return NextResponse.json(
                {
                    error: `ElevenLabs API error: ${response.status}`,
                    details: errorText,
                },
                { status: 500 }
            );
        }

        const data = await response.json();
        console.log("ElevenLabs simulate-conversation response:", data);

        // Extract the last agent message from the simulated conversation
        const simulatedConversation = data.simulated_conversation || [];
        const lastAgentMessage =
            simulatedConversation
                .filter((msg: any) => msg.role === "agent")
                .pop()?.message || "";

        console.log("Last agent message:", lastAgentMessage);

        return NextResponse.json({
            response: lastAgentMessage,
            conversation_id: data.conversation_id,
            full_response: data, // Include full response for debugging
        });
    } catch (error) {
        console.error("ElevenLabs Conversational AI error:", error);
        return NextResponse.json(
            { error: "Failed to get conversational response" },
            { status: 500 }
        );
    }
}
