"use client";

import React from "react";
import { useRouter } from "next/navigation";
import InterviewStageScreen from "app/shared/components/InterviewStageScreen";

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
    <InterviewStageScreen
      onSubmit={handleStartCoding}
      ctaText="Start Coding Challenge"
      bgGradient="from-blue-50 to-white"
    >
      {/* Completion Message */}
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
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-4xl font-semibold text-gray-800 mb-4">
          Great Work!
        </h1>
      </div>
      
      {/* Instructions */}
      <div className="space-y-3 mb-6">
        <div className="bg-white rounded-2xl p-5 border-2 border-purple-300 shadow-sm">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-sm font-semibold text-sfinx-purple">1</span>
            </div>
            <p className="text-gray-700 text-lg leading-relaxed pt-0.5">
              Click below to start your coding challenge!
            </p>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-5 border-2 border-purple-300 shadow-sm">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-sm font-semibold text-sfinx-purple">2</span>
            </div>
            <p className="text-gray-700 text-lg leading-relaxed pt-0.5">
              When asked to, please select <span className="font-medium">&quot;Share Entire Screen&quot;</span>
            </p>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-5 border-2 border-purple-300 shadow-sm">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-sm font-semibold text-sfinx-purple">3</span>
            </div>
            <p className="text-gray-700 text-lg leading-relaxed pt-0.5">
              Once you start, you&apos;ll have{" "}
              <span className="font-bold text-sfinx-purple">
                {codingTimeChallenge} minutes
              </span>{" "}
              to complete the challenge
            </p>
          </div>
        </div>
      </div>
    </InterviewStageScreen>
  );
}
