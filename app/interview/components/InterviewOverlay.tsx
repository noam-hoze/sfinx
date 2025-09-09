"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface InterviewOverlayProps {
    isCodingStarted: boolean;
    isInterviewActive: boolean;
    isInterviewLoading: boolean;
    onStartInterview: () => void;
}

const InterviewOverlay: React.FC<InterviewOverlayProps> = ({
    isCodingStarted,
    isInterviewActive,
    isInterviewLoading,
    onStartInterview,
}) => {
    if (isCodingStarted) return null;

    return (
        <div className="absolute inset-0 bg-white/80 dark:bg-black/70 backdrop-blur-md flex items-center justify-center select-none transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] opacity-100">
            <div className="text-center">
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
                    Welcome to your interview session
                </h2>
                <p className="mt-2 text-base md:text-lg text-gray-600 dark:text-gray-300">
                    {isInterviewActive
                        ? "Waiting for instructions..."
                        : "Click Start Interview and wait for instructions"}
                </p>
                {!isInterviewActive && (
                    <div className="mt-6 flex flex-col items-center">
                        <button
                            onClick={onStartInterview}
                            disabled={isInterviewLoading}
                            className={`px-6 py-3 text-sm font-medium rounded-full transform transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-sm flex items-center gap-2 ${
                                isInterviewLoading
                                    ? "bg-gray-100 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-400"
                                    : "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/10 dark:text-green-400 dark:hover:bg-green-900/20"
                            } translate-y-2`}
                            title={
                                isInterviewLoading
                                    ? "Starting Interview..."
                                    : "Start Interview"
                            }
                        >
                            {isInterviewLoading && (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            )}
                            {isInterviewLoading
                                ? "Starting Interview..."
                                : "Start Interview"}
                        </button>
                        {isInterviewLoading && (
                            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <Loader2 className="w-3 h-3 animate-spin opacity-70" />
                                <span>Preparing audio & permissions…</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default InterviewOverlay;
