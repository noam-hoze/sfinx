"use client";

import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEW_UI;

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useMute } from "app/shared/contexts";

type AnnouncementScreenProps = {
  text: string;
  preloadedAudioBlob?: Blob | null;
  onComplete: () => void;
  useHeyGenSpeech?: boolean;
  onAvatarSpeak?: (text: string) => Promise<void>;
  isAvatarReady?: boolean;
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
  useHeyGenSpeech,
  onAvatarSpeak,
  isAvatarReady,
}: AnnouncementScreenProps) {
  /**
   * Plays a spoken announcement while revealing the text word by word before advancing the flow.
   */
  const { isMuted } = useMute();
  const [displayedWords, setDisplayedWords] = useState<string[]>([]);
  const [audioFinished, setAudioFinished] = useState(false);
  const [typingFinished, setTypingFinished] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasStartedRef = useRef(false);

  /**
   * Resets the announcement state for a fresh run.
   */
  const resetAnnouncement = React.useCallback(() => {
    setDisplayedWords([]);
    setAudioFinished(false);
    setTypingFinished(false);
    setFadingOut(false);
  }, []);

  /**
   * Starts the typing animation aligned with the announcement text.
   */
  const startTyping = React.useCallback((words: string[]) => {
    const WORDS_PER_SECOND = 3;
    const MS_PER_WORD = 1000 / WORDS_PER_SECOND;
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < words.length) {
        const wordToAdd = words[currentIndex];
        currentIndex++;
        setDisplayedWords((prev) => {
          if (prev.length > 0 && prev[prev.length - 1] === wordToAdd) {
            return prev;
          }
          return [...prev, wordToAdd];
        });
      } else {
        setTypingFinished(true);
        clearInterval(interval);
      }
    }, MS_PER_WORD);

    return interval;
  }, []);

  /**
   * Plays announcement speech using HeyGen or fallback TTS.
   */
  const playHeyGenAnnouncement = React.useCallback(async () => {
    if (!onAvatarSpeak || !isAvatarReady) {
      log.error(LOG_CATEGORY, "[Announcement] HeyGen unavailable for announcement");
      setAudioFinished(true);
      return;
    }
    try {
      await onAvatarSpeak(text);
      setAudioFinished(true);
    } catch (error) {
      log.error(LOG_CATEGORY, "[Announcement] HeyGen speech failed:", error);
      setAudioFinished(true);
    }
  }, [isAvatarReady, onAvatarSpeak, text]);

  /**
   * Plays fallback TTS for the announcement when HeyGen is disabled.
   */
  const playTtsAnnouncement = React.useCallback(async () => {
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
      audio.volume = isMuted ? 0 : 1;
      audio.onended = () => {
        setAudioFinished(true);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      await audio.play();
    } catch (error) {
      log.error(LOG_CATEGORY, "[Announcement] TTS failed:", error);
      setAudioFinished(true);
    }
  }, [isMuted, preloadedAudioBlob, text]);

  /**
   * Plays announcement speech using HeyGen or fallback TTS.
   */
  const playAnnouncementSpeech = React.useCallback(async () => {
    if (isMuted) {
      setAudioFinished(true);
      return;
    }
    if (useHeyGenSpeech) {
      await playHeyGenAnnouncement();
      return;
    }
    await playTtsAnnouncement();
  }, [isMuted, playHeyGenAnnouncement, playTtsAnnouncement, useHeyGenSpeech]);

  useEffect(() => {
    // Prevent multiple executions of the same announcement
    if (hasStartedRef.current) {
      return;
    }
    
    hasStartedRef.current = true;
    
    const words = text.split(" ");
    resetAnnouncement();
    playAnnouncementSpeech();
    const interval = startTyping(words);

    return () => {
      clearInterval(interval);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [playAnnouncementSpeech, resetAnnouncement, startTyping, text]);

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
      className="flex items-start justify-start gap-4 w-full max-w-4xl"
      initial={{ opacity: 1 }}
      animate={{ opacity: fadingOut ? 0 : 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Waving hand emoji - always visible, stays on left */}
      <div className="text-5xl flex-shrink-0">👋</div>
      
      {/* Typing text container - grows to the right */}
      <div className="flex-1 min-w-0">
        <p className="text-2xl text-gray-800 leading-relaxed text-left">
          {displayedWords.join(" ")}
        </p>
      </div>
    </motion.div>
  );
}
