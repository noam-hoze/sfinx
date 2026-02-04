"use client";

import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEW_UI;

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useMute } from "app/shared/contexts";
import { generateTTS } from "@/shared/services/tts";
import { generateVisemesAndAudio } from "@/shared/services/mascot";
import { convertPCMToWAV } from "@/shared/utils/audioConversion";
import type { Viseme } from "@/shared/types/mascot";
import { useWordByWordAnimation } from "../hooks/useWordByWordAnimation";

type AnnouncementScreenProps = {
  text: string;
  preloadedAudioBlob?: Blob | null;
  onComplete: () => void;
  onAudioStateChange?: (isPlaying: boolean, intentText?: string, visemes?: Viseme[]) => void;
};

export default function AnnouncementScreen({
  text,
  preloadedAudioBlob,
  onComplete,
  onAudioStateChange,
}: AnnouncementScreenProps) {
  /**
   * Plays a spoken announcement while revealing the text word by word before advancing the flow.
   */
  const { isMuted } = useMute();
  const mascotEnabled = process.env.NEXT_PUBLIC_MASCOT_ENABLED === "true";
  const [audioFinished, setAudioFinished] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasStartedRef = useRef(false);

  // Use word-by-word animation hook - only start when audio is ready
  const { displayedWords, isTypingComplete: typingFinished } = useWordByWordAnimation({
    text,
    enabled: audioReady,
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
    setAudioReady(false);

    // Play TTS (preloaded or generate on-demand)
    (async () => {
      try {
        let blob: Blob;
        let visemes: Viseme[] = [];
        
        if (mascotEnabled) {
          const result = await generateVisemesAndAudio(text);
          visemes = result.visemes;
          const wavBuffer = convertPCMToWAV(result.audioBase64);
          blob = new Blob([wavBuffer], { type: "audio/wav" });
        } else if (preloadedAudioBlob) {
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

        audio.onplay = () => {
          onAudioStateChange?.(true, undefined, visemes);
        };

        audio.onended = () => {
          setAudioFinished(true);
          onAudioStateChange?.(false, undefined, []);  // Pass empty visemes to stop lip sync
          URL.revokeObjectURL(url);
          audioRef.current = null;
        };

        // Start text animation at the same time as audio playback
        setAudioReady(true);
        await audio.play();
      } catch (error) {
        log.error(LOG_CATEGORY, "[Announcement] TTS failed:", error);
        onAudioStateChange?.(false, undefined, []);  // Pass empty visemes to stop lip sync
        // Even if audio fails, continue with typing animation
        setAudioReady(true);
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
        <p className="text-2xl text-gray-800 leading-relaxed inline-flex items-center justify-center gap-2 flex-wrap">
          <motion.span
            className="inline-block origin-[70%_70%]"
            animate={{
              rotate: [0, 14, -8, 14, -4, 10, 0],
              scale: [1, 1.1, 1.05, 1.1, 1.05, 1.1, 1],
            }}
            transition={{
              duration: 1.8,
              ease: "easeInOut",
              times: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1],
              repeat: 2,
              repeatDelay: 0.5,
            }}
          >
            👋
          </motion.span>
          <span>{displayedWords.join(" ")}</span>
        </p>
      </div>
    </motion.div>
  );
}

