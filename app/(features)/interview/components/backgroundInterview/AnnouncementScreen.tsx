"use client";

import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEW_UI;

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useMute } from "app/shared/contexts";
import { useWordByWordAnimation } from "../hooks/useWordByWordAnimation";

type AnnouncementScreenProps = {
  text: string;
  preloadedAudioBlob?: Blob | null;
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
  preloadedAudioBlob,
  onComplete,
}: AnnouncementScreenProps) {
  /**
   * Plays a spoken announcement while revealing the text word by word before advancing the flow.
   */
  const { isMuted } = useMute();
  const [audioFinished, setAudioFinished] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasStartedRef = useRef(false);

  // Use word-by-word animation hook
  const { displayedWords, isTypingComplete: typingFinished } = useWordByWordAnimation({
    text,
    enabled: true,
    wordsPerSecond: 3,
  });

  useEffect(() => {
    // Prevent multiple executions of the same announcement
    if (hasStartedRef.current) {
      return;
    }
    
    hasStartedRef.current = true;

    // Reset state when text changes
    setAudioFinished(false);
    setFadingOut(false);

    // Play TTS (preloaded or generate on-demand)
    (async () => {
      try {
        let blob: Blob;
        
        if (preloadedAudioBlob) {
          blob = preloadedAudioBlob;
        } else {
          const audioBuffer = await generateTTS(text);
          blob = new Blob([audioBuffer], { type: "audio/mpeg" });
        }
        
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        // Set initial volume based on mute state
        audio.volume = isMuted ? 0 : 1;

        audio.onended = () => {
          setAudioFinished(true);
          URL.revokeObjectURL(url);
          audioRef.current = null;
        };

        await audio.play();
      } catch (error) {
        log.error(LOG_CATEGORY, "[Announcement] TTS failed:", error);
        // Even if audio fails, continue with typing animation
        setAudioFinished(true);
      }
    })();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [text, preloadedAudioBlob]);

  // Handle mute toggle - only change volume, don't stop playback
  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : 1;
    }
  }, [isMuted]);

  // Call onComplete when both audio and typing are done
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (audioFinished && typingFinished && !fadingOut) {
      setFadingOut(true);
      
      // Wait for fade animation then call onComplete
      setTimeout(() => {
        onCompleteRef.current();
      }, 500); // Match fade duration
    }
  }, [audioFinished, typingFinished, fadingOut]);

  return (
    <motion.div 
      className="flex flex-col items-center justify-center w-full"
      initial={{ opacity: 1 }}
      animate={{ opacity: fadingOut ? 0 : 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Typing text container - centered with emoji inline */}
      <div className="w-full text-center px-8">
        <p className="text-2xl text-gray-800 leading-relaxed">
          👋 {displayedWords.join(" ")}
        </p>
      </div>
    </motion.div>
  );
}

