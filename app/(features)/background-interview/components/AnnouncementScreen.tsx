"use client";

import React, { useState, useEffect, useRef } from "react";

type AnnouncementScreenProps = {
  text: string;
  onComplete: () => void;
};

/**
 * Calls server-side TTS API to generate audio for announcement
 */
async function generateTTS(text: string): Promise<ArrayBuffer> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS API failed (${response.status}): ${errorText}`);
  }

  return response.arrayBuffer();
}

export default function AnnouncementScreen({
  text,
  onComplete,
}: AnnouncementScreenProps) {
  const [displayedWords, setDisplayedWords] = useState<string[]>([]);
  const [audioFinished, setAudioFinished] = useState(false);
  const [typingFinished, setTypingFinished] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const words = text.split(" ");
  const WORDS_PER_SECOND = 2.5;
  const MS_PER_WORD = 1000 / WORDS_PER_SECOND;

  useEffect(() => {
    // Generate and play TTS
    (async () => {
      try {
        console.log("[Announcement] Generating TTS for:", text);
        const audioBuffer = await generateTTS(text);
        
        const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          setAudioFinished(true);
          URL.revokeObjectURL(url);
          audioRef.current = null;
          console.log("[Announcement] Audio finished");
        };

        await audio.play();
        console.log("[Announcement] Audio started");
      } catch (error) {
        console.error("[Announcement] TTS failed:", error);
        // Even if audio fails, continue with typing animation
        setAudioFinished(true);
      }
    })();

    // Start typing animation
    let wordIndex = 0;
    const interval = setInterval(() => {
      if (wordIndex < words.length) {
        setDisplayedWords((prev) => [...prev, words[wordIndex]]);
        wordIndex++;
      } else {
        setTypingFinished(true);
        clearInterval(interval);
        console.log("[Announcement] Typing finished");
      }
    }, MS_PER_WORD);

    return () => {
      clearInterval(interval);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [text]);

  // Call onComplete when both audio and typing are done
  useEffect(() => {
    if (audioFinished && typingFinished) {
      console.log("[Announcement] Complete");
      onComplete();
    }
  }, [audioFinished, typingFinished, onComplete]);

  return (
    <div className="flex items-center justify-center gap-4">
      {/* Waving hand emoji */}
      <div className="text-5xl">👋</div>
      
      {/* Typing text */}
      <p className="text-2xl text-gray-800 leading-relaxed">
        {displayedWords.join(" ")}
      </p>
    </div>
  );
}

