"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type QuestionCardProps = {
  question: string;
  onSubmitAnswer: (answer: string) => void;
  loading: boolean;
};

export default function QuestionCard({
  question,
  onSubmitAnswer,
  loading,
}: QuestionCardProps) {
  const [answer, setAnswer] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [prevQuestion, setPrevQuestion] = useState("");

  // Detect question change for animation
  React.useEffect(() => {
    if (question && question !== prevQuestion) {
      setPrevQuestion(question);
    }
  }, [question, prevQuestion]);

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

  return (
    <div className="w-full max-w-3xl">
      <AnimatePresence mode="wait">
        <motion.div
          key={question}
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="bg-white rounded-2xl shadow-lg p-8"
        >
          {/* Question Text */}
          <div className="mb-8">
            <h2 className="text-2xl text-gray-800 font-normal leading-relaxed">
              {question || "Loading question..."}
            </h2>
          </div>

          {/* Input Controls */}
          <div className="flex items-start gap-3">
            {/* Text Input */}
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer here."
              disabled={loading}
              rows={6}
              className="flex-1 px-4 py-3 text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed resize-none placeholder:text-gray-400"
            />

            {/* Control Buttons Column */}
            <div className="flex flex-col gap-3">
              {/* Voice Mode Button (Microphone Icon) */}
              <button
                onClick={() => setInputMode("voice")}
                disabled={loading}
                className={`p-3.5 rounded-lg transition-colors ${
                  inputMode === "voice"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Voice input"
              >
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </button>

              {/* Keyboard Mode Button */}
              <button
                onClick={() => setInputMode("text")}
                disabled={loading}
                className={`p-3.5 rounded-lg transition-colors ${
                  inputMode === "text"
                    ? "bg-gray-100 text-gray-700"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Text input"
              >
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z" />
                </svg>
              </button>

              {/* Submit Button (Right Arrow) */}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="p-3.5 bg-white border-2 border-gray-300 text-gray-600 rounded-lg hover:border-blue-600 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

