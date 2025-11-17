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
};

export default function CompletionScreen({
  codingTimeChallenge,
  onStartCoding,
  jobId,
  userId,
  companyId,
  applicationId,
}: CompletionScreenProps) {
  const router = useRouter();

  const handleStartCoding = () => {
    // Set sessionStorage flag to auto-start interview on next page
    sessionStorage.setItem("sfinx-demo-autostart", "true");
    
    router.push(
      `/interview?demo=true&jobId=${jobId}&userId=${userId}&companyId=${companyId}&applicationId=${applicationId}`
    );
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
          <h1 className="text-4xl font-semibold text-gray-800 mb-6">
            Great Work!
          </h1>
          <p className="text-lg text-gray-600 mb-8 text-center">
            You&apos;re now moving on to the coding challenge.
          </p>
          
          {/* Instructions */}
          <div className="space-y-6 mb-10 text-left max-w-xl mx-auto">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
                <span className="text-sm font-semibold text-sfinx-purple">1</span>
              </div>
              <p className="text-gray-700 leading-relaxed pt-0.5">
                On the next page, you&apos;ll be asked to share your screen — please select <span className="font-medium">Share Entire Screen</span>.
              </p>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
                <span className="text-sm font-semibold text-sfinx-purple">2</span>
              </div>
              <p className="text-gray-700 leading-relaxed pt-0.5">
                Once you click the button below, you&apos;ll have{" "}
                <span className="font-bold text-sfinx-purple">
                  {codingTimeChallenge} minutes
                </span>{" "}
                to complete the challenge.
              </p>
            </div>
          </div>
          
          {/* Ready prompt */}
          <p className="text-lg text-gray-500 mb-8 text-center">
            Ready when you are!
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
