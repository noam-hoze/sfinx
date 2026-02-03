/**
 * REFERENCE IMPLEMENTATION - DO NOT DELETE
 * 
 * This is the working proof-of-concept for Mascotbot integration.
 * 
 * Production implementation located at:
 * - Services: shared/services/mascot.ts, shared/services/tts.ts
 * - Utilities: shared/utils/audioConversion.ts
 * - Component: app/(features)/interview/components/RiveMascot.tsx
 * - API Route: app/api/mascot/visemes-audio/route.ts
 * 
 * Keep this file for troubleshooting and validation purposes.
 * This implementation demonstrates the complete end-to-end flow:
 * 1. Text input → Mascotbot API
 * 2. SSE stream parsing for visemes and PCM audio
 * 3. PCM to WAV conversion
 * 4. Rive animation with lip-sync playback
 */

"use client";

import React, { useState } from "react";
import { useRive } from "@rive-app/react-webgl2";
import { MascotProvider, MascotClient, useMascot, useMascotPlayback } from "@mascotbot-sdk/react";

const MascotDisplay = () => {
  const { rive, RiveComponent } = useMascot();
  const playback = useMascotPlayback();
  const [text, setText] = useState("Hello, I am testing the mascot!");
  const [isLoading, setIsLoading] = useState(false);

  // Debug: Log rive instance and inputs
  React.useEffect(() => {
    if (rive) {
      console.log("Rive loaded successfully");
      console.log("Available state machines:", rive.stateMachineNames);
      
      const inputs = rive.stateMachineInputs("InLesson");
      console.log("InLesson state machine inputs:", inputs);
      inputs?.forEach(input => {
        console.log(`Input: ${input.name}, Type: ${input.type}`);
      });
    }
  }, [rive]);

  const handleSpeak = async () => {
    setIsLoading(true);
    try {
      // Use Mascotbot's TTS + visemes endpoint for simplicity
      const response = await fetch("/api/test-mascot-speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const { visemes, audioBase64 } = await response.json();
      
      console.log("Visemes received:", visemes?.length);
      console.log("First few visemes:", visemes?.slice(0, 5));
      console.log("Audio base64 length:", audioBase64?.length);

      // Play visemes
      playback.reset();
      playback.add(visemes);
      playback.play();

      // Play audio if available
      if (audioBase64 && audioBase64.length > 0) {
        try {
          const binaryString = atob(audioBase64);
          const pcmData = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            pcmData[i] = binaryString.charCodeAt(i);
          }
          
          // Wrap PCM in WAV container (24000 Hz, 16-bit, mono)
          const sampleRate = 24000;
          const numChannels = 1;
          const bitsPerSample = 16;
          const wavHeader = new Uint8Array(44);
          const view = new DataView(wavHeader.buffer);
          
          // RIFF header
          view.setUint32(0, 0x52494646, false); // "RIFF"
          view.setUint32(4, 36 + pcmData.length, true); // file size - 8
          view.setUint32(8, 0x57415645, false); // "WAVE"
          
          // fmt chunk
          view.setUint32(12, 0x666d7420, false); // "fmt "
          view.setUint32(16, 16, true); // chunk size
          view.setUint16(20, 1, true); // audio format (PCM)
          view.setUint16(22, numChannels, true); // num channels
          view.setUint32(24, sampleRate, true); // sample rate
          view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true); // byte rate
          view.setUint16(32, numChannels * bitsPerSample / 8, true); // block align
          view.setUint16(34, bitsPerSample, true); // bits per sample
          
          // data chunk
          view.setUint32(36, 0x64617461, false); // "data"
          view.setUint32(40, pcmData.length, true); // data size
          
          const wavData = new Uint8Array(wavHeader.length + pcmData.length);
          wavData.set(wavHeader, 0);
          wavData.set(pcmData, wavHeader.length);
          
          const audioBlob = new Blob([wavData.buffer], { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          await audio.play();
        } catch (audioError) {
          console.error("Audio playback error:", audioError);
        }
      } else {
        console.warn("No audio received from API");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <h1 className="text-2xl font-bold">Mascot Test</h1>
      <div className="w-[400px] h-[400px] border-2 border-gray-300 rounded">
        <RiveComponent />
      </div>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-[400px] px-4 py-2 border rounded"
        placeholder="Enter text"
      />
      <button
        onClick={handleSpeak}
        disabled={isLoading}
        className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {isLoading ? "Processing..." : "Speak"}
      </button>
    </div>
  );
};

export default function TestMascotPage() {
  const rive = useRive({
    src: "/realisticFemale.riv",
    artboard: "Character",
    stateMachines: "InLesson",  // Correct state machine name from realisticFemale.riv
    autoplay: true,
  });

  return (
    <MascotProvider>
      <MascotClient rive={rive}>
        <MascotDisplay />
      </MascotClient>
    </MascotProvider>
  );
}
