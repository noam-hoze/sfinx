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
  preloadedVisemes?: Viseme[];
  onComplete: () => void;
  onAudioStateChange?: (isPlaying: boolean, intentText?: string, visemes?: Viseme[]) => void;
};

export default function AnnouncementScreen({
  text,
  preloadedAudioBlob,
  preloadedVisemes,
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
        let visemes: Viseme[] = [];

        // Use preloaded audio and visemes if available
        if (preloadedAudioBlob && preloadedVisemes) {
          log.info(LOG_CATEGORY, "[Announcement] Using preloaded audio and visemes");
          blob = preloadedAudioBlob;
          visemes = preloadedVisemes;
        } else if (preloadedAudioBlob) {
          log.info(LOG_CATEGORY, "[Announcement] Using preloaded audio (no visemes)");
          blob = preloadedAudioBlob;
        } else if (mascotEnabled) {
          log.info(LOG_CATEGORY, "[Announcement] Generating mascot audio on-demand");
          const result = await generateVisemesAndAudio(text);
          visemes = result.visemes;
          const wavBuffer = convertPCMToWAV(result.audioBase64);
          blob = new Blob([wavBuffer], { type: "audio/wav" });
        } else {
          log.info(LOG_CATEGORY, "[Announcement] Generating TTS audio on-demand");
          const audioBuffer = await generateTTS(text);
          blob = new Blob([audioBuffer], { type: "audio/mpeg" });
        }
        
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        // Set initial volume based on mute state
        audio.volume = isMuted ? 0 : 1;

        audio.onplay = () => {
          log.info(LOG_CATEGORY, "[Announcement] Audio playing - passing", visemes.length, "visemes to state handler");
          onAudioStateChange?.(true, undefined, visemes);
        };

        audio.onended = () => {
          setAudioFinished(true);
          onAudioStateChange?.(false, undefined, []);  // Pass empty visemes to stop lip sync
          URL.revokeObjectURL(url);
          audioRef.current = null;
        };

        await audio.play();
      } catch (error) {
        log.error(LOG_CATEGORY, "[Announcement] TTS failed:", error);
        onAudioStateChange?.(false, undefined, []);  // Pass empty visemes to stop lip sync
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
  }, [text, preloadedAudioBlob, preloadedVisemes, mascotEnabled, isMuted, onAudioStateChange]);

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

