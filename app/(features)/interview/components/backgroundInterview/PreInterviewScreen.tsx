"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import InterviewStageScreen from "app/shared/components/InterviewStageScreen";

type PreInterviewNotice = {
  title: string;
  description: string;
};

type PreInterviewScreenProps = {
  onStartInterview: () => void;
  backgroundTimeMinutes: number;
  notice?: PreInterviewNotice | null;
  loading?: boolean;
};

/**
 * Pre-interview instruction screen shown before the background interview begins.
 * Informs the candidate about interview duration and screen sharing requirements.
 */
export default function PreInterviewScreen({
  onStartInterview,
  backgroundTimeMinutes,
  notice,
  loading,
}: PreInterviewScreenProps) {
  return (
    <InterviewStageScreen
      onSubmit={onStartInterview}
      ctaText="Start Interview"
      bgGradient="from-purple-50 to-white"
      loading={loading}
    >
      {/* Welcome Message */}
      <div className="flex flex-col items-center mb-4">
        <div className="w-20 h-20 mb-4 rounded-full bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-sfinx-purple"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <h1 className="text-4xl font-semibold text-gray-800 mb-4">
          Ready to Begin?
        </h1>
      </div>
      
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            className="glass-card mb-6 rounded-squircle-sm border border-red-200/70 bg-red-50/80 p-4"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M4.938 19h14.124c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.206 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight text-red-700">{notice.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-red-700/90">{notice.description}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions */}
      <div className="space-y-3 mb-6">
        <div className="bg-white rounded-2xl p-5 border-2 border-purple-300 shadow-sm">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-sm font-semibold text-sfinx-purple">1</span>
            </div>
            <p className="text-gray-700 text-lg leading-relaxed pt-0.5">
              This interview will take approximately{" "}
              <span className="font-bold text-sfinx-purple">
                {backgroundTimeMinutes} minutes
              </span>
            </p>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-5 border-2 border-purple-300 shadow-sm">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-sm font-semibold text-sfinx-purple">2</span>
            </div>
            <p className="text-gray-700 text-lg leading-relaxed pt-0.5">
              When asked to share your screen, please share your{" "}
              <span className="font-bold text-sfinx-purple">
                full screen
              </span>
            </p>
          </div>
        </div>
      </div>
    </InterviewStageScreen>
  );
}
