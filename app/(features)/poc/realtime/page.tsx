"use client";

import { useState } from "react";
import OpenAI from "openai";

export default function ChatDirectJsonTest() {
  const [result, setResult] = useState<string>("");

  const openai = new OpenAI({
    apiKey: "***REMOVED***",
    dangerouslyAllowBrowser: true, // ✅ allows calling from browser
  });

  async function sendTest() {
    setResult("Loading...");

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Return ONLY JSON: {"ok":true,"time":${Date.now()}}`,
          },
        ],
        response_format: { type: "json_object" }, // ✅ enforce JSON
      });

      const jsonText = completion.choices[0].message.content ?? "";
      setResult(jsonText);
    } catch (err: any) {
      setResult(`ERROR: ${err.message}`);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <button onClick={sendTest}>Send JSON Test</button>
      <pre style={{ marginTop: 12 }}>{result}</pre>
    </div>
  );
}
