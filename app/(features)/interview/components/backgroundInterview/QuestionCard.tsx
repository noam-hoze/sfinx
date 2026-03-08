"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMute } from "app/shared/contexts";
import { loadAndCacheSoundEffect } from "@/shared/utils/audioCache";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import { generateTTS } from "@/shared/services/tts";
import { generateVisemesAndAudio } from "@/shared/services/mascot";
import { convertPCMToWAV } from "@/shared/utils/audioConversion";
import type { Viseme } from "@/shared/types/mascot";
import { useWordByWordAnimation } from "../hooks/useWordByWordAnimation";
import { useDispatch, useSelector } from "react-redux";
import { incrementDontKnowCount } from "@/shared/state/slices/backgroundSlice";
import type { RootState } from "@/shared/state/store";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEW_UI;

/**
 * Generates TTS and optionally mascot visemes
 */
async function generateAudioAndVisemes(
  question: string,
  mascotEnabled: boolean
): Promise<{ audioBlob: Blob; visemes: Viseme[] }> {
  if (mascotEnabled) {
    return await generateWithMascot(question);
  }
  return await generateWithoutMascot(question);
}

/**
 * Generates audio with mascot visemes
 */
async function generateWithMascot(
  question: string
): Promise<{ audioBlob: Blob; visemes: Viseme[] }> {
  const { visemes, audioBase64 } = await generateVisemesAndAudio(question);
  const wavBuffer = convertPCMToWAV(audioBase64);
  const audioBlob = new Blob([wavBuffer], { type: "audio/wav" });
  return { audioBlob, visemes };
}

/**
 * Generates audio without mascot
 */
async function generateWithoutMascot(
  question: string
): Promise<{ audioBlob: Blob; visemes: Viseme[] }> {
  const audioBuffer = await generateTTS(question);
  const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
  return { audioBlob, visemes: [] };
}

type QuestionCardProps = {
  question: string;
  onSubmitAnswer: (answer: string) => void;
  loading: boolean;
  micStream: MediaStream | null;
  isFirstQuestion?: boolean;
  interviewSessionId?: string | null;
  getActualRecordingStartTime?: () => Date | null;
  questionNumber?: number;
  userId?: string;
  onAudioStateChange?: (isPlaying: boolean, intentText?: string, visemes?: Viseme[]) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  intentText?: string;
};

export default function QuestionCard({
  question,
  onSubmitAnswer,
  loading,
  micStream,
  isFirstQuestion = false,
  interviewSessionId,
  getActualRecordingStartTime,
  questionNumber = 1,
  userId,
  onAudioStateChange,
  onRecordingStateChange,
  intentText,
}: QuestionCardProps) {
  /**
   * Presents a background interview question with TTS playback and text/voice answer capture.
   */
  const { isMuted } = useMute();
  const mascotEnabled = process.env.NEXT_PUBLIC_MASCOT_ENABLED === "true";

  // Redux state for client-side counter optimization
  const dispatch = useDispatch();
  const currentFocusTopic = useSelector((state: RootState) => state.background.currentFocusTopic);

  const [answer, setAnswer] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [prevQuestion, setPrevQuestion] = useState("");
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioFinished, setAudioFinished] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [showBlankAnswerDialog, setShowBlankAnswerDialog] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const controlsSoundRef = useRef<HTMLAudioElement | null>(null);
  const submitClickTimeRef = useRef<Date>(new Date());
  const questionReadyTimeRef = useRef<Date>(new Date()); // Timestamp when question becomes fully available

  // Word-by-word animation for question text
  const [questionAnimationEnabled, setQuestionAnimationEnabled] = useState(false);
  const { displayedWords, isTypingComplete, completeAnimation } = useWordByWordAnimation({
    text: question,
    enabled: questionAnimationEnabled,
    wordsPerSecond: 3,
  });

  // Preload sounds on mount - wait for them to be fully ready (with caching)
  React.useEffect(() => {
    loadAndCacheSoundEffect("/sounds/controls-appear.mp3", "controls-appear").then(controlsSound => {
      controlsSoundRef.current = controlsSound;
      log.info(LOG_CATEGORY, "[QuestionCard] Controls sound loaded (with cache)");
    }).catch(err => {
      log.error(LOG_CATEGORY, "[QuestionCard] Failed to load controls sound:", err);
    });
  }, []);

  // TTS + question change detection
  React.useEffect(() => {
    if (question && question !== prevQuestion) {
      setPrevQuestion(question);
      setTtsError(null);
      setIsAudioPlaying(false);
      setAudioFinished(false);
      setIsTextExpanded(false); // Reset text input to collapsed state
      setAnswer(""); // Clear any previous answer
      setIsTranscribing(false); // Reset transcription state
      questionReadyTimeRef.current = new Date(); // Reset question ready timestamp for new question

      // If muted, skip TTS, animation, and show controls immediately
      if (isMuted) {
        log.info(LOG_CATEGORY, "[QuestionCard] Muted - skipping TTS and animation, showing controls immediately");
        setQuestionAnimationEnabled(false); // No animation when muted before start
        setIsAudioPlaying(true);
        setAudioFinished(true);
        onAudioStateChange?.(false, intentText, []);  // Pass empty visemes - no lip sync when muted
        return;
      }

      // Enable animation for new question
      setQuestionAnimationEnabled(true);

      // Generate and play TTS
      (async () => {
        try {
          log.info(LOG_CATEGORY, "[QuestionCard] Generating audio for:", question);
          const { audioBlob, visemes } = await generateAudioAndVisemes(question, mascotEnabled);
          
          // Stop any currently playing audio
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }
          
          // Create audio element
          const url = URL.createObjectURL(audioBlob);
          const audio = new Audio(url);
          audioRef.current = audio;

          // Set initial volume based on mute state
          audio.volume = isMuted ? 0 : 1;

          audio.onplay = () => {
            // Capture timestamp when question audio STARTS playing (not when it finishes)
            questionReadyTimeRef.current = new Date();

            setIsAudioPlaying(true);
            onAudioStateChange?.(true, undefined, visemes);
            log.info(LOG_CATEGORY, "[QuestionCard] Audio playback started");
          };

          audio.onended = () => {
            setAudioFinished(true);
            onAudioStateChange?.(false, intentText, []);  // Pass empty visemes to explicitly stop lip sync
            URL.revokeObjectURL(url);
            audioRef.current = null;
            log.info(LOG_CATEGORY, "[QuestionCard] Audio playback finished");
          };

          await audio.play();
        } catch (error) {
          log.error(LOG_CATEGORY, "[QuestionCard] TTS failed:", error);
          setTtsError(
            error instanceof Error ? error.message : "TTS generation failed"
          );
          setIsAudioPlaying(true); // Show question even if audio fails
          setAudioFinished(true); // Skip to finished state if audio fails
        }
      })();
    }
  }, [question, prevQuestion, isMuted]);

  // Handle mute toggle during playback - special behavior for QuestionCard
  React.useEffect(() => {
    // Handle animation completion when muted during animation
    if (isMuted && questionAnimationEnabled && !isTypingComplete) {
      log.info(LOG_CATEGORY, "[QuestionCard] Mute toggled ON during animation - completing animation smoothly");
      completeAnimation();
    }

    // Handle audio
    if (audioRef.current) {
      if (isMuted && !audioFinished) {
        // Special "read mode" behavior: stop audio and show controls immediately
        log.info(LOG_CATEGORY, "[QuestionCard] Mute toggled ON - stopping audio and showing controls (read mode)");
        audioRef.current.pause();
        audioRef.current = null;
        setAudioFinished(true);
        onAudioStateChange?.(false, intentText, []);  // Pass empty visemes to stop lip sync
      } else if (!isMuted) {
        // Unmuted: ensure volume is on
        audioRef.current.volume = 1;
      }
    }
  }, [isMuted, audioFinished, questionAnimationEnabled, isTypingComplete, completeAnimation, onAudioStateChange, intentText]);

  // Note: questionReadyTimeRef is set when audio starts, not when it finishes
  // This ensures evidence clips point to when the question is asked, not answered

  // Play sound when controls appear (after audio finishes)
  React.useEffect(() => {
    if (audioFinished && controlsSoundRef.current) {
      try {
        log.info(LOG_CATEGORY, "[QuestionCard] Playing controls-appear sound");
        controlsSoundRef.current.volume = isMuted ? 0 : 1;
        controlsSoundRef.current.currentTime = 0; // Reset to start
        controlsSoundRef.current.play().catch(err => log.error(LOG_CATEGORY, "Controls-appear sound error:", err));
      } catch (error) {
        log.error(LOG_CATEGORY, "[QuestionCard] Failed to play controls-appear sound:", error);
      }
    }
  }, [audioFinished]);

  // Cleanup audio and recording on unmount
  React.useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  // Keyboard shortcuts for dialog
  React.useEffect(() => {
    if (!showBlankAnswerDialog) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Go Back logic
        setShowBlankAnswerDialog(false);
        setDontAskAgain(false);
      }
      if (e.key === "Enter") {
        // Skip logic
        if (dontAskAgain && typeof window !== "undefined") {
          localStorage.setItem("sfinx:skipBlankAnswerDialog:disabled", "true");
        }
        setShowBlankAnswerDialog(false);
        submitClickTimeRef.current = new Date();

        if (interviewSessionId) {
          createBackgroundEvidenceLink("I don't know").catch(err =>
            log.error(LOG_CATEGORY, '[QuestionCard] Failed to create evidence link:', err)
          );
        }

        onSubmitAnswer("I don't know");
        setAnswer("");
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showBlankAnswerDialog, dontAskAgain, interviewSessionId, onSubmitAnswer]);

  // Gibberish detection helper (matches backend logic)
  const isGibberishAnswer = (text: string): boolean => {
    const trimmed = text.trim();

    // Very short (< 3 chars) or only repeating characters
    if (trimmed.length < 3 || /^(.)\1+$/.test(trimmed)) return true;

    // Only special characters/numbers (no letters)
    if (!/[a-zA-Z]/.test(trimmed)) return true;

    // Single character repeated many times
    if (/^(.)\1{4,}$/.test(trimmed)) return true;

    // Too many consonants in a row (keyboard mashing)
    if (/([bcdfghjklmnpqrstvwxyz]{3,})/gi.test(trimmed) && trimmed.length < 15) return true;

    return false;
  };

  const handleSubmit = async () => {
    // Check if answer is blank or gibberish
    const isBlank = answer.trim().length === 0;
    const isGibberish = !isBlank && isGibberishAnswer(answer);
    const isExactDontKnow = answer.trim().toLowerCase() === "i don't know";

    if (isBlank || isGibberish) {
      // Check localStorage preference (SSR-safe)
      if (typeof window !== "undefined") {
        const disabled = localStorage.getItem("sfinx:skipBlankAnswerDialog:disabled");
        if (disabled === "true") {
          // Auto-submit "I don't know" without showing dialog
          submitClickTimeRef.current = new Date();
          if (interviewSessionId) {
            createBackgroundEvidenceLink("I don't know").catch(err =>
              log.error(LOG_CATEGORY, '[QuestionCard] Failed to create evidence link:', err)
            );
          }

          // CLIENT-SIDE INCREMENT removed so server controls state
          // if (currentFocusTopic) {
          //   dispatch(incrementDontKnowCount({ category: currentFocusTopic }));
          //   log.info(LOG_CATEGORY, `[QuestionCard] Client-side increment for auto-skip: ${currentFocusTopic}`);
          // }

          onSubmitAnswer("I don't know");
          setAnswer("");
          return;
        }
      }

      // Show confirmation dialog
      setShowBlankAnswerDialog(true);
      return;
    }

    // Existing submit logic for valid answers
    submitClickTimeRef.current = new Date();
    if (interviewSessionId) {
      createBackgroundEvidenceLink(answer).catch(err =>
        log.error(LOG_CATEGORY, '[QuestionCard] Failed to create evidence link:', err)
      );
    }

    // CLIENT-SIDE INCREMENT removed so server controls state
    // if (isExactDontKnow && currentFocusTopic) {
    //   dispatch(incrementDontKnowCount({ category: currentFocusTopic }));
    //   log.info(LOG_CATEGORY, `[QuestionCard] Client-side increment for exact text: ${currentFocusTopic}`);
    // }

    onSubmitAnswer(answer);
    setAnswer("");
  };

  const handleSkipQuestion = () => {
    // Save preference if checkbox is checked
    if (dontAskAgain && typeof window !== "undefined") {
      localStorage.setItem("sfinx:skipBlankAnswerDialog:disabled", "true");
    }

    // Close dialog and submit "I don't know"
    setShowBlankAnswerDialog(false);
    submitClickTimeRef.current = new Date();

    if (interviewSessionId) {
      createBackgroundEvidenceLink("I don't know").catch(err =>
        log.error(LOG_CATEGORY, '[QuestionCard] Failed to create evidence link:', err)
      );
    }

    // IMMEDIATE CLIENT-SIDE INCREMENT removed so server controls state
    // if (currentFocusTopic) {
    //   dispatch(incrementDontKnowCount({ category: currentFocusTopic }));
    //   log.info(LOG_CATEGORY, `[QuestionCard] Client-side increment for skip: ${currentFocusTopic}`);
    // }

    onSubmitAnswer("I don't know");
    setAnswer("");
  };

  const handleGoBack = () => {
    setShowBlankAnswerDialog(false);
    setDontAskAgain(false); // Reset checkbox state
  };

  /**
   * Creates a background evidence link for video timeline
   */
  const createBackgroundEvidenceLink = async (answerText: string) => {
    if (!interviewSessionId) {
      log.warn(LOG_CATEGORY, '[QuestionCard] No interview session ID for evidence link');
      return;
    }

    // Use the timestamp when the question audio started playing
    const evidenceTimestamp = questionReadyTimeRef.current;

    log.info(LOG_CATEGORY, '[QuestionCard] Creating background evidence link for question', questionNumber);
    
    const url = `/api/interviews/session/${interviewSessionId}/background-evidence`;
    
    const body: Record<string, any> = {
      timestamp: evidenceTimestamp.toISOString(),
      questionText: question,
      answerText: answerText,
      questionNumber,
    };
    
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    log.info(LOG_CATEGORY, '[QuestionCard] Evidence link created successfully');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleTextInput = () => {
    setIsTextExpanded(!isTextExpanded);
  };

  const startVoiceRecording = async () => {
    if (!micStream) {
      setRecordingError("Microphone not available");
      return;
    }

    try {
      setRecordingError(null);
      log.info(LOG_CATEGORY, "[QuestionCard] Starting recording with pre-granted mic...");
      
      const mimeType = "audio/webm;codecs=opus";
      const mediaRecorder = new MediaRecorder(micStream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        log.info(LOG_CATEGORY, "[QuestionCard] Recording stopped, transcribing...");
        setIsTranscribing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");

          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error("Transcription failed");
          }

          const { text } = await response.json();
          log.info(LOG_CATEGORY, "[QuestionCard] Transcription:", text);
          setAnswer(text);
          setIsTextExpanded(true); // Show the text area with transcribed text
        } catch (error) {
          log.error(LOG_CATEGORY, "[QuestionCard] Transcription error:", error);
          setRecordingError(
            error instanceof Error ? error.message : "Transcription failed"
          );
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      onRecordingStateChange?.(true);
      log.info(LOG_CATEGORY, "[QuestionCard] Recording started");
    } catch (error) {
      log.error(LOG_CATEGORY, "[QuestionCard] Recording start error:", error);
      setRecordingError(
        error instanceof Error ? error.message : "Failed to start recording"
      );
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      onRecordingStateChange?.(false);
      log.info(LOG_CATEGORY, "[QuestionCard] Stopping recording...");
    }
  };

  return (
    <div className="w-[48rem] max-w-full">
      <AnimatePresence mode="wait">
        {(isAudioPlaying || ttsError) && (
          <motion.div
            key={question}
            initial={isFirstQuestion ? { x: 0, opacity: 0 } : { x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="w-full"
          >
            {/* Single card with question and controls */}
            <motion.div
                initial={{ backgroundColor: "rgba(255, 255, 255, 0)" }}
                animate={{
                  backgroundColor: audioFinished ? "rgba(255, 255, 255, 1)" : "rgba(255, 255, 255, 0)",
                  boxShadow: audioFinished ? "0 10px 15px -3px rgb(0 0 0 / 0.1)" : "0 0 0 0 rgb(0 0 0 / 0)"
                }}
                transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                className="rounded-2xl overflow-hidden border border-gray-200 w-full"
              >
                {/* Question Section */}
                <div className="p-8 pb-6 w-full min-h-[120px]">
                  <p data-testid="question-text" className="text-2xl text-gray-800 leading-relaxed font-light text-left w-full">
                    {questionAnimationEnabled ? displayedWords.join(" ") : question || "Loading question..."}
                  </p>
                  {ttsError && (
                    <div className="mt-4 flex items-center gap-2 text-red-600 text-sm">
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Audio playback failed: {ttsError}</span>
                    </div>
                  )}
                  {recordingError && (
                    <div className="mt-4 flex items-center gap-2 text-red-600 text-sm">
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Recording failed: {recordingError}</span>
                    </div>
                  )}
                </div>

                {/* Divider line and Controls Section - reveal from top when audio finishes */}
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ 
                    height: audioFinished ? "auto" : 0,
                    opacity: audioFinished ? 1 : 0
                  }}
                  transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  {/* Thin divider */}
                  <div className="border-t border-gray-200"></div>
                  
                  {/* Controls Section */}
                  <div className="p-8 pt-6">
                    {/* Transcribing Indicator - shows while recording or transcribing */}
                    {(isRecording || isTranscribing) && (
                      <div className="mb-4 flex items-center gap-3 text-gray-600">
                        <svg
                          className="w-5 h-5 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <span>Transcribing answer...</span>
                      </div>
                    )}

                    {/* Input Controls */}
                    <div className="flex flex-col gap-4">
            {/* Collapsed Answer Preview - shows when answer exists and text box is collapsed */}
            {!isTextExpanded && answer.trim() && (
              <button
                onClick={() => setIsTextExpanded(true)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span className="text-gray-700 font-medium">Your answer</span>
                </div>
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}

            {/* Expandable Text Input */}
            <AnimatePresence>
              {isTextExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <textarea
                    data-testid="answer-input"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your answer here."
                    disabled={loading}
                    rows={6}
                    autoFocus
                    className="w-full px-4 py-3 text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-300 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed resize-none placeholder:text-gray-400"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Control Buttons Row */}
            <div className="flex items-center justify-start gap-3">
              {/* Answer Button (Microphone) */}
              <button
                onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                disabled={loading}
                className={`px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 ${
                  isRecording
                    ? "bg-sfinx-purple hover:opacity-90 text-white"
                    : answer.trim()
                    ? "border-2 border-blue-500 text-blue-500 bg-white hover:bg-blue-50"
                    : "bg-sfinx-purple hover:opacity-90 text-white"
                }`}
                title={isRecording ? "Done recording" : answer.trim() ? "Record again" : "Voice input"}
              >
                {isRecording ? (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    Done
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                    {answer.trim() ? "Redo" : "Answer"}
                  </>
                )}
              </button>

              {/* Keyboard Toggle Button */}
              <button
                data-testid="toggle-text-input"
                onClick={toggleTextInput}
                disabled={loading}
                className="p-3 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Toggle text input"
              >
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z" />
                </svg>
              </button>

              {/* Submit Button (Right Arrow) - always visible */}
              <button
                data-testid="submit-answer-btn"
                onClick={handleSubmit}
                disabled={loading || isRecording || isTranscribing}
                className="ml-auto p-3 bg-white border-2 border-gray-300 text-gray-600 rounded-lg hover:border-sfinx-purple hover:text-sfinx-purple disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                title="Submit answer"
              >
                {loading ? (
                  <svg
                    className="w-6 h-6 animate-spin text-sfinx-purple"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
                  </div>
                </motion.div>
              </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blank Answer Confirmation Dialog */}
      <AnimatePresence>
        {showBlankAnswerDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={handleGoBack}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Title */}
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                No answer yet
              </h2>

              {/* Body */}
              <p className="text-base text-gray-600 mb-6">
                Would you like to skip this question?
              </p>

              {/* Buttons */}
              <div className="flex gap-3 mb-6">
                <button
                  onClick={handleGoBack}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Go Back
                </button>
                <button
                  onClick={handleSkipQuestion}
                  className="flex-1 px-6 py-3 bg-sfinx-purple text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
                >
                  Skip
                </button>
              </div>

              {/* Checkbox */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    dontAskAgain
                      ? "bg-sfinx-purple border-sfinx-purple"
                      : "border-gray-300 bg-white"
                  }`}
                  onClick={() => setDontAskAgain(!dontAskAgain)}
                >
                  {dontAskAgain && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-600">Don't ask again</span>
              </label>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

