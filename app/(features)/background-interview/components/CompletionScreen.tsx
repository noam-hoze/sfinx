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
          <h1 className="text-4xl font-semibold text-gray-800 mb-4">
            Background Phase Complete!
          </h1>
          <p className="text-xl text-gray-600">
            You have <span className="font-bold text-blue-600">{codingTimeChallenge} minutes</span> to
            complete your coding task.
          </p>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartCoding}
          className="px-8 py-4 bg-blue-600 text-white rounded-lg font-medium text-lg hover:bg-blue-700 transition-colors"
        >
          Start Coding Challenge
        </button>
      </motion.div>
    </div>
  );
}

