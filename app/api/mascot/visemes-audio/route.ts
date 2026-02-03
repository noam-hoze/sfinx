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

    const mascotApiKey = process.env.NEXT_PUBLIC_MASCOTBOT_API_KEY;
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVEN_LABS_CANDIDATE_VOICE_ID;

    if (!mascotApiKey) {
      console.error("[Mascot API] Mascotbot API key missing");
      return NextResponse.json({ error: "Mascotbot API key missing" }, { status: 500 });
    }

    if (!elevenLabsApiKey) {
      console.error("[Mascot API] ElevenLabs API key missing");
      return NextResponse.json({ error: "ElevenLabs API key missing" }, { status: 500 });
    }

    if (!voiceId) {
      console.error("[Mascot API] Voice ID missing");
      return NextResponse.json({ error: "Voice ID missing" }, { status: 500 });
    }

    console.log("[Mascot API] Generating TTS and visemes for text:", text);
    console.log("[Mascot API] Using ElevenLabs voice ID:", voiceId);

    const response = await fetch("https://api.mascot.bot/v1/visemes-audio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${mascotApiKey}`,
      },
      body: JSON.stringify({
        text,
        tts_engine: "elevenlabs",
        tts_api_key: elevenLabsApiKey,
        voice: voiceId,
        speed: 1.0,
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
              console.log("[Mascot API] SSE event type:", data.type, "keys:", Object.keys(data));

              if (data.type === 'audio' && data.data) {
                audioChunks.push(data.data);
              }

              if (data.visemes) {
                visemes.push(...data.visemes);
              }

              if (data.audio_sequence && typeof data.audio_sequence === 'string') {
                audioChunks.push(data.audio_sequence);
              }
            } catch (e) {
              console.error("[Mascot API] Failed to parse SSE line:", line.substring(0, 100));
            }
          }
        }
      }
    }
    const audioBase64 = audioChunks.join('');
    console.log("[Mascot API] Total visemes collected:", visemes.length);
    console.log("[Mascot API] Audio chunks collected:", audioChunks.length);
    console.log("[Mascot API] Audio base64 length:", audioBase64.length);
    console.log("[Mascot API] First 100 chars of audio:", audioBase64.substring(0, 100));
    console.log("[Mascot API] Audio looks like base64:", /^[A-Za-z0-9+/=]*$/.test(audioBase64));

    if (!audioBase64 || audioBase64.length === 0) {
      console.error("[Mascot API] No audio data received");
      return NextResponse.json({ error: "No audio data received" }, { status: 500 });
    }

    return NextResponse.json({ visemes, audioBase64 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
