"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type QuestionCardProps = {
  question: string;
  onSubmitAnswer: (answer: string) => void;
  loading: boolean;
  micStream: MediaStream | null;
};

/**
 * Calls server-side TTS API to generate audio for text
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

export default function QuestionCard({
  question,
  onSubmitAnswer,
  loading,
  micStream,
}: QuestionCardProps) {
  const [answer, setAnswer] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [prevQuestion, setPrevQuestion] = useState("");
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioFinished, setAudioFinished] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // TTS + question change detection
  React.useEffect(() => {
    if (question && question !== prevQuestion) {
      setPrevQuestion(question);
      setTtsError(null);
      setIsAudioPlaying(false);
      setAudioFinished(false);
      setIsTextExpanded(false); // Reset text input to collapsed state
      setAnswer(""); // Clear any previous answer

      // Generate and play TTS
      (async () => {
        try {
          console.log("[QuestionCard] Generating TTS for:", question);
          const audioBuffer = await generateTTS(question);
          
          // Stop any currently playing audio
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }

          // Create audio element and autoplay
          const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;

          audio.onplay = () => {
            setIsAudioPlaying(true);
            console.log("[QuestionCard] TTS playback started");
          };

          audio.onended = () => {
            setAudioFinished(true);
            URL.revokeObjectURL(url);
            audioRef.current = null;
            console.log("[QuestionCard] TTS playback finished");
          };

          await audio.play();
        } catch (error) {
          console.error("[QuestionCard] TTS failed:", error);
          setTtsError(
            error instanceof Error ? error.message : "TTS generation failed"
          );
          setIsAudioPlaying(true); // Show question even if audio fails
          setAudioFinished(true); // Skip to finished state if audio fails
        }
      })();
    }
  }, [question, prevQuestion]);

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

  const handleSubmit = () => {
    onSubmitAnswer(answer);
    setAnswer("");
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
      console.log("[QuestionCard] Starting recording with pre-granted mic...");
      
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
        console.log("[QuestionCard] Recording stopped, transcribing...");
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
          console.log("[QuestionCard] Transcription:", text);
          setAnswer(text);
          setIsTextExpanded(true); // Show the text area with transcribed text
        } catch (error) {
          console.error("[QuestionCard] Transcription error:", error);
          setRecordingError(
            error instanceof Error ? error.message : "Transcription failed"
          );
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      console.log("[QuestionCard] Recording started");
    } catch (error) {
      console.error("[QuestionCard] Recording start error:", error);
      setRecordingError(
        error instanceof Error ? error.message : "Failed to start recording"
      );
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log("[QuestionCard] Stopping recording...");
    }
  };

  return (
    <div className="w-full max-w-3xl">
      <AnimatePresence mode="wait">
        <motion.div
          key={question}
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          {/* Loading state - before audio starts */}
          {!isAudioPlaying && !ttsError ? (
            <div className="flex items-center justify-center py-8">
              <svg
                className="w-8 h-8 text-gray-400 animate-spin"
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
            </div>
          ) : (
            <>
              {/* Single card with question and controls */}
              <motion.div
                initial={{ backgroundColor: "rgba(255, 255, 255, 0)" }}
                animate={{ 
                  backgroundColor: audioFinished ? "rgba(255, 255, 255, 1)" : "rgba(255, 255, 255, 0)",
                  boxShadow: audioFinished ? "0 10px 15px -3px rgb(0 0 0 / 0.1)" : "0 0 0 0 rgb(0 0 0 / 0)"
                }}
                transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                className="rounded-2xl overflow-hidden border border-gray-200"
              >
                {/* Question Section */}
                <div className="p-8 pb-6">
                  <h2 className="text-2xl text-gray-800 font-normal leading-relaxed">
                    {question || "Loading question..."}
                  </h2>
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
                    {/* Transcribing Indicator - shows while recording */}
                    {isRecording && (
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
            {/* Expandable Text Input */}
            {isTextExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your answer here."
                  disabled={loading}
                  rows={6}
                  autoFocus
                  className="w-full px-4 py-3 text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed resize-none placeholder:text-gray-400"
                />
              </motion.div>
            )}

            {/* Control Buttons Row */}
            <div className="flex items-center justify-start gap-3">
              {/* Answer Button (Microphone) */}
              <button
                onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                disabled={loading}
                className={`px-6 py-3 ${
                  isRecording
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-blue-600 hover:bg-blue-700"
                } text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2`}
                title={isRecording ? "Done recording" : "Voice input"}
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
                    Answer
                  </>
                )}
              </button>

              {/* Keyboard Toggle Button */}
              <button
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
                onClick={handleSubmit}
                disabled={loading}
                className="ml-auto p-3 bg-white border-2 border-gray-300 text-gray-600 rounded-lg hover:border-blue-600 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                title="Submit answer"
              >
                {loading ? (
                  <svg
                    className="w-6 h-6 animate-spin"
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
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

