import { NextResponse } from "next/server";

// Types for better type safety
interface ElevenLabsResponse {
    signed_url: string;
}

interface ErrorResponse {
    error: string;
    details?: string;
    timestamp: string;
}

// Response headers for optimization
const RESPONSE_HEADERS = {
    'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    'Content-Type': 'application/json',
} as const;

export async function GET() {
    const startTime = Date.now();
    
    try {
        // Validate environment variables
        if (!process.env.ELEVENLABS_API_KEY) {
            console.error("Missing ELEVENLABS_API_KEY environment variable");
            return NextResponse.json(
                { 
                    error: "Server configuration error",
                    timestamp: new Date().toISOString()
                } satisfies ErrorResponse,
                { 
                    status: 500,
                    headers: RESPONSE_HEADERS
                }
            );
        }

        if (!process.env.NEXT_PUBLIC_AGENT_ID) {
            console.error("Missing NEXT_PUBLIC_AGENT_ID environment variable");
            return NextResponse.json(
                { 
                    error: "Server configuration error",
                    timestamp: new Date().toISOString()
                } satisfies ErrorResponse,
                { 
                    status: 500,
                    headers: RESPONSE_HEADERS
                }
            );
        }

        const url = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${process.env.NEXT_PUBLIC_AGENT_ID}`;
        
        console.log(`Requesting signed URL for agent: ${process.env.NEXT_PUBLIC_AGENT_ID}`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                "xi-api-key": process.env.ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
                "User-Agent": "Sfinx-Interview-App/1.0",
            },
            // Add timeout to prevent hanging requests
            signal: AbortSignal.timeout(10000), // 10 seconds
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error(`ElevenLabs API error: ${response.status} ${response.statusText}`, errorText);
            
            return NextResponse.json(
                { 
                    error: "Failed to generate signed URL from ElevenLabs",
                    details: `API returned ${response.status}: ${response.statusText}`,
                    timestamp: new Date().toISOString()
                } satisfies ErrorResponse,
                { 
                    status: response.status >= 500 ? 502 : 400,
                    headers: RESPONSE_HEADERS
                }
            );
        }

        const data: ElevenLabsResponse = await response.json();
        
        // Validate response structure
        if (!data.signed_url || typeof data.signed_url !== 'string') {
            console.error("Invalid response from ElevenLabs API:", data);
            return NextResponse.json(
                { 
                    error: "Invalid response from ElevenLabs API",
                    timestamp: new Date().toISOString()
                } satisfies ErrorResponse,
                { 
                    status: 502,
                    headers: RESPONSE_HEADERS
                }
            );
        }

        const responseTime = Date.now() - startTime;
        console.log(`Successfully generated signed URL in ${responseTime}ms`);

        return NextResponse.json(
            { signedUrl: data.signed_url },
            { 
                status: 200,
                headers: {
                    ...RESPONSE_HEADERS,
                    'X-Response-Time': `${responseTime}ms`,
                }
            }
        );

    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        // Handle different types of errors
        let errorMessage = "Internal server error";
        let errorDetails = "Unknown error occurred";
        
        if (error instanceof Error) {
            errorMessage = error.name === 'AbortError' ? "Request timeout" : "Failed to generate signed URL";
            errorDetails = error.message;
        }

        console.error(`API error after ${responseTime}ms:`, error);

        return NextResponse.json(
            { 
                error: errorMessage,
                details: errorDetails,
                timestamp: new Date().toISOString()
            } satisfies ErrorResponse,
            { 
                status: 500,
                headers: {
                    ...RESPONSE_HEADERS,
                    'X-Response-Time': `${responseTime}ms`,
                }
            }
        );
    }
}
