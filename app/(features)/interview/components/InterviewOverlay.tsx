"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

function formatDurationLabel(seconds?: number | null) {
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
        return null;
    }
    const minutes = Math.round(seconds / 60);
    if (minutes > 0) {
        return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    }
    return `${Math.round(seconds)}s`;
}

interface InterviewOverlayProps {
    isCodingStarted: boolean;
    isInterviewActive: boolean;
    isInterviewLoading: boolean;
    onStartInterview: () => void;
    isAgentConnected?: boolean;
    interviewConcluded?: boolean;
    candidateName?: string;
    hasSubmitted?: boolean;
    backgroundDurationSeconds?: number;
    codingDurationSeconds?: number;
}

const InterviewOverlay: React.FC<InterviewOverlayProps> = ({
    isCodingStarted,
    isInterviewActive,
    isInterviewLoading,
    onStartInterview,
    isAgentConnected = false,
    interviewConcluded = false,
    candidateName = "Candidate",
    hasSubmitted = false,
    backgroundDurationSeconds,
    codingDurationSeconds,
}) => {
    // Derive stage from props
    const derivedStage = useMemo(() => {
        if (interviewConcluded) return "submitted";
        // Once loading starts, treat as a distinct forward-only stage
        if (isInterviewLoading) return "loading";
        // Pre-stage wrapping as soon as coding starts (overlay remains hidden while coding)
        if (hasSubmitted || isCodingStarted) return "wrapping";
        if (isInterviewActive && isAgentConnected) return "started";
        return "welcome";
    }, [
        interviewConcluded,
        hasSubmitted,
        isCodingStarted,
        isInterviewActive,
        isAgentConnected,
        isInterviewLoading,
    ]);

    // Local stage to enable cross-fade
    const [stage, setStage] = useState<string>(derivedStage);
    const [visible, setVisible] = useState<boolean>(true);
    const [subtitleVisible, setSubtitleVisible] = useState<boolean>(true);

    useEffect(() => {
        if (derivedStage === stage) return;
        setVisible(false);
        const t = setTimeout(() => {
            setStage(derivedStage);
            setVisible(true);
        }, 260);
        return () => clearTimeout(t);
    }, [derivedStage, stage]);

    useEffect(() => {
        setSubtitleVisible(false);
        const t = setTimeout(() => setSubtitleVisible(true), 160);
        return () => clearTimeout(t);
    }, [isInterviewLoading]);

    const backgroundDurationLabel = useMemo(
        () => formatDurationLabel(backgroundDurationSeconds),
        [backgroundDurationSeconds]
    );
    const codingDurationLabel = useMemo(
        () => formatDurationLabel(codingDurationSeconds),
        [codingDurationSeconds]
    );

    // Replaced ellipsis with smooth spinner

    // Fade overlay out when coding starts (cross-fade timing aligned with stage fade)
    const containerVisibility = isCodingStarted
        ? "opacity-0 pointer-events-none"
        : "opacity-100";

    return (
        <div
            className={`absolute inset-0 z-20 bg-white/80 dark:bg-black/70 backdrop-blur-md flex items-center justify-center select-none transition-opacity duration-500 ease-out ${containerVisibility}`}
        >
            <div
                className={`text-center transition-opacity duration-500 ${
                    visible ? "opacity-100" : "opacity-0"
                }`}
            >
                {stage === "submitted" ? (
                    <div className="px-6">
                        <div className="mb-8">
                            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                                <svg
                                    className="w-12 h-12 text-blue-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                        </div>
                        <h2 className="text-3xl font-light text-gray-900 mb-2 tracking-tight dark:text-white">
                            {`Thank you for your time ${candidateName}`}
                        </h2>
                        <p className="text-lg text-gray-600 font-light dark:text-gray-300">
                            Good luck!
                        </p>
                    </div>
                ) : stage === "started" ? (
                    <>
                        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
                            Interview Started!
                        </h2>
                        <p className="mt-2 text-base md:text-lg text-gray-600 dark:text-gray-300">
                            just speak naturally 😎
                        </p>
                    </>
                ) : stage === "wrapping" ? (
                    <>
                        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
                            Wrapping things up
                        </h2>
                        <p className="mt-2 text-base md:text-lg text-gray-600 dark:text-gray-300">
                            waiting for the interviewer to finish the closing
                            line…
                        </p>
                    </>
                ) : (
                    <>
                        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
                            Welcome to your interview session
                        </h2>
                        <p
                            className={`mt-2 text-base md:text-lg text-gray-600 dark:text-gray-300 transition-opacity duration-300 ${
                                subtitleVisible ? "opacity-100" : "opacity-0"
                            }`}
                        >
                            {stage === "loading" ? (
                                <span className="inline-flex items-center gap-2">
                                    <span>Getting things started</span>
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                                </span>
                            ) : (
                                "Click Start Interview and wait for instructions"
                            )}
                        </p>
                        {backgroundDurationLabel && codingDurationLabel ? (
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {`Background: ${backgroundDurationLabel}. Coding: ${codingDurationLabel}.`}
                            </p>
                        ) : null}
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
                                        ? "Getting things started..."
                                        : "Start Interview"
                                }
                            >
                                Start Interview
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default InterviewOverlay;
