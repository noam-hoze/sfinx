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

    // Call Mascotbot API with text (generates both audio and visemes)
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
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              const data = JSON.parse(jsonStr);
              
              // #region agent log
              fetch('http://127.0.0.1:7244/ingest/a7a962d3-a365-4cdf-9479-10209a61a26e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:50',message:'SSE chunk parsed',data:{type:data.type,hasData:!!data.data,dataLen:data.data?.length,hasAudioSeq:!!data.audio_sequence,audioSeqLen:data.audio_sequence?.length,hasVisemes:!!data.visemes,visemeCount:data.visemes?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'audio-debug',hypothesisId:'A,D'})}).catch(()=>{});
              // #endregion
              
              // Handle audio chunks
              if (data.type === 'audio' && data.data) {
                // #region agent log
                fetch('http://127.0.0.1:7244/ingest/a7a962d3-a365-4cdf-9479-10209a61a26e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:54',message:'Audio chunk received',data:{chunkIndex:audioChunks.length,firstChars:data.data.substring(0,20),length:data.data.length},timestamp:Date.now(),sessionId:'debug-session',runId:'audio-debug',hypothesisId:'A,B,D'})}).catch(()=>{});
                // #endregion
                audioChunks.push(data.data);
              }
              
              // Handle viseme chunks
              if (data.visemes) {
                visemes.push(...data.visemes);
              }
              
              // Alternative: audio_sequence field
              if (data.audio_sequence) {
                // #region agent log
                fetch('http://127.0.0.1:7244/ingest/a7a962d3-a365-4cdf-9479-10209a61a26e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:68',message:'Audio sequence received',data:{chunkIndex:audioChunks.length,firstChars:data.audio_sequence.substring(0,20),length:data.audio_sequence.length},timestamp:Date.now(),sessionId:'debug-session',runId:'audio-debug',hypothesisId:'A,B,D'})}).catch(()=>{});
                // #endregion
                audioChunks.push(data.audio_sequence);
              }
            } catch (e) {
              // Skip incomplete JSON
            }
          }
        }
      }
    }

    const audioBase64 = audioChunks.join('');
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a7a962d3-a365-4cdf-9479-10209a61a26e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:77',message:'Audio concatenated',data:{chunkCount:audioChunks.length,totalLength:audioBase64.length,firstChars:audioBase64.substring(0,30),visemeCount:visemes.length},timestamp:Date.now(),sessionId:'debug-session',runId:'audio-debug',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.log("[Mascot API] Total visemes collected:", visemes.length);
    console.log("[Mascot API] Audio chunks collected:", audioChunks.length);
    console.log("[Mascot API] Audio base64 length:", audioBase64.length);
    return NextResponse.json({ visemes, audioBase64 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
