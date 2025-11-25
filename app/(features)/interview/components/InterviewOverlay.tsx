"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import SfinxSpinner from "app/shared/components/SfinxSpinner";

function shouldHideStartButton(): boolean {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("sfinx-demo-autostart") === "true";
}

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
    codingDurationSeconds,
}) => {
    const commMethodRaw = (process.env.NEXT_PUBLIC_INTERVIEW_COMM_METHOD || "speech")
        .toLowerCase()
        .trim();
    const isTextMode =
        commMethodRaw === "text" ||
        commMethodRaw === "true" ||
        commMethodRaw === "1" ||
        commMethodRaw === "yes";

    // Derive stage from props
    const derivedStage = useMemo(() => {
        if (interviewConcluded) return "submitted";
        // Computing insights after submission
        if (isInterviewLoading && hasSubmitted) return "computing";
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
    const [hideStartButton, setHideStartButton] = useState<boolean>(false);
    const [computingMessageIndex, setComputingMessageIndex] = useState<number>(0);

    const computingMessages = [
        "Analyzing your performance",
        "Still working on it",
        "Running AI evaluations",
        "Almost there",
        "Finalizing your results"
    ];

    useEffect(() => {
        setHideStartButton(shouldHideStartButton());
    }, []);

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

    useEffect(() => {
        if (stage === "computing") {
            setComputingMessageIndex(0);
            const timer = setInterval(() => {
                setComputingMessageIndex((prevIndex) => {
                    if (prevIndex < computingMessages.length - 1) {
                        return prevIndex + 1;
                    }
                    return prevIndex; // Stick with the last message
                });
            }, 3500);
            return () => clearInterval(timer);
        } else {
            setComputingMessageIndex(0);
        }
    }, [stage, computingMessages.length]);

    const codingDurationLabel = useMemo(
        () => formatDurationLabel(codingDurationSeconds),
        [codingDurationSeconds]
    );

    // Replaced ellipsis with smooth spinner

    // Fade overlay out when coding starts or interview is active (cross-fade timing aligned with stage fade)
    // But show it again when computing insights or when submitted
    const containerVisibility = (isCodingStarted || (isInterviewActive && isAgentConnected)) && stage !== "computing" && stage !== "submitted"
        ? "opacity-0 pointer-events-none"
        : "opacity-100";

    return (
        <>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
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
                            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center text-5xl">
                                👏
                            </div>
                        </div>
                        <h2 className="text-3xl font-light text-gray-900 mb-2 tracking-tight dark:text-white">
                            {`Thank you for your time ${candidateName}`}
                        </h2>
                        <p className="text-lg text-gray-600 font-light dark:text-gray-300">
                            Good luck!
                        </p>
                    </div>
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
                ) : stage === "computing" ? (
                    <div className="-mt-32">
                        <div className="mb-8">
                            <SfinxSpinner size="lg" />
                        </div>
                        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white mb-4">
                            Computing interview insights
                        </h2>
                        <p className="text-base md:text-lg text-gray-600 dark:text-gray-300">
                            <span 
                                key={computingMessageIndex} 
                                className="transition-opacity duration-[2000ms] opacity-0"
                                style={{ animation: 'fadeIn 0.5s ease-in forwards' }}
                            >
                                {computingMessages[computingMessageIndex]}
                            </span>
                        </p>
                    </div>
                ) : (
                    <>
                        {stage === "loading" || hideStartButton ? (
                            <div className="-mt-32">
                                <div className="mb-8">
                                    <SfinxSpinner size="lg" />
                                </div>
                                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white mb-4">
                                    Welcome to your interview session
                                </h2>
                                <p className="text-base md:text-lg text-gray-600 dark:text-gray-300">
                                    Getting things started
                                </p>
                            </div>
                        ) : (
                            <>
                                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
                                    Welcome to your interview session
                                </h2>
                                <p className="mt-2 text-base md:text-lg text-gray-600 dark:text-gray-300">
                                    Click Start Interview and wait for instructions
                                </p>
                            </>
                        )}
                        {!hideStartButton && stage !== "loading" && (
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
                        )}
                    </>
                )}
            </div>
        </div>
        </>
    );
};

export default InterviewOverlay;
