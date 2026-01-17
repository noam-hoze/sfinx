/**
 * Production API route for Mascotbot viseme and audio generation
 * Based on working test implementation at /api/test-mascot-speak
 */

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (!body) {
      return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    }
    const { text } = JSON.parse(body);

    if (!text) {
      return NextResponse.json({ error: "Text required" }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_MASCOTBOT_API_KEY;
    if (!apiKey) {
      console.error("[Mascot API] API key missing");
      return NextResponse.json({ error: "API key missing" }, { status: 500 });
    }

    console.log("[Mascot API] Generating TTS and visemes for text:", text);

    const response = await fetch("https://api.mascot.bot/v1/visemes-audio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        text,
        voice: "am_fenrir",
      }),
    });

    console.log("[Mascot API] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Mascot API] Error response:", errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    // Parse SSE stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    const visemes: any[] = [];
    const audioChunks: string[] = [];
    let buffer = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ""; // Keep the last incomplete line

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              const data = JSON.parse(jsonStr);
              
              if (data.type === 'audio' && data.data) {
                audioChunks.push(data.data);
              }
              
              if (data.visemes) {
                visemes.push(...data.visemes);
              }
              
              if (data.audio_sequence && typeof data.audio_sequence === 'string') {
                audioChunks.push(data.audio_sequence);
              }
            } catch (e) { /* Skip incomplete JSON */ }
          }
        }
      }
    }
    const audioBase64 = audioChunks.join('');
    console.log("[Mascot API] Total visemes collected:", visemes.length);
    console.log("[Mascot API] Audio chunks collected:", audioChunks.length);
    console.log("[Mascot API] Audio base64 length:", audioBase64.length);
    return NextResponse.json({ visemes, audioBase64 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
