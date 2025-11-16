"use client";

import React from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

type CompletionScreenProps = {
  codingTimeChallenge: number;
  onStartCoding: () => void;
  jobId: string;
  userId: string;
  companyId: string;
  applicationId: string;
  sessionId: string;
};

export default function CompletionScreen({
  codingTimeChallenge,
  onStartCoding,
  jobId,
  userId,
  companyId,
  applicationId,
  sessionId,
}: CompletionScreenProps) {
  const router = useRouter();

  const handleStartCoding = () => {
    router.push(`/interview?demo=true&jobId=${jobId}&userId=${userId}&companyId=${companyId}&applicationId=${applicationId}&sessionId=${sessionId}`);
  };
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-2xl shadow-lg p-12 max-w-2xl text-center"
      >
        {/* Completion Message */}
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center">
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
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-semibold text-gray-800 mb-4">
            Background Phase Complete
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            Now it&apos;s time to move forward to the coding challenge. Once you click the button below you will have <span className="font-bold text-sfinx-purple">{codingTimeChallenge} minutes</span> to complete it. Are you ready?
          </p>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartCoding}
          className="px-8 py-4 bg-sfinx-purple text-white rounded-lg font-medium text-lg hover:opacity-90 transition-all"
        >
          Start Coding Challenge
        </button>
      </motion.div>
    </div>
  );
}

