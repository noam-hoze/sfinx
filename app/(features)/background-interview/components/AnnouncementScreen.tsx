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

  useEffect(() => {
    // Reset state when text changes
    setDisplayedWords([]);
    setAudioFinished(false);
    setTypingFinished(false);

    const words = text.split(" ");
    const WORDS_PER_SECOND = 5;
    const MS_PER_WORD = 1000 / WORDS_PER_SECOND;

    console.log("[Announcement] Starting with text:", text);
    console.log("[Announcement] Words array:", words);

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
    console.log("[Announcement] Total words to display:", words.length);
    
    const interval = setInterval(() => {
      console.log("[Announcement] Interval tick, wordIndex:", wordIndex, "of", words.length);
      if (wordIndex < words.length) {
        console.log("[Announcement] Displaying word", wordIndex, ":", words[wordIndex]);
        setDisplayedWords((prev) => {
          const newWords = [...prev, words[wordIndex]];
          console.log("[Announcement] New displayedWords array:", newWords);
          return newWords;
        });
        wordIndex++;
      } else {
        console.log("[Announcement] Typing finished, displayed", wordIndex, "words total");
        setTypingFinished(true);
        clearInterval(interval);
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
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (audioFinished && typingFinished) {
      console.log("[Announcement] Complete, total words displayed:", displayedWords.length);
      onCompleteRef.current();
    }
  }, [audioFinished, typingFinished, displayedWords.length]);

  return (
    <div className="flex items-start justify-start gap-4 w-full max-w-4xl">
      {/* Waving hand emoji - always visible, stays on left */}
      <div className="text-5xl flex-shrink-0">👋</div>
      
      {/* Typing text container - grows to the right */}
      <div className="flex-1 min-w-0">
        <p className="text-2xl text-gray-800 leading-relaxed text-left">
          {displayedWords.join(" ")}
        </p>
      </div>
    </div>
  );
}

