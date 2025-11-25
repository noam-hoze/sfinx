"use client";

import React, { useEffect, useMemo, useState } from "react";
import SfinxSpinner from "app/shared/components/SfinxSpinner";

/**
 * Props for the interview overlay component.
 */
interface InterviewOverlayProps {
    isCodingStarted: boolean;
    isInterviewActive: boolean;
    isInterviewLoading: boolean;
    isAgentConnected?: boolean;
    interviewConcluded?: boolean;
    candidateName?: string;
    hasSubmitted?: boolean;
}

/**
 * Overlay component for interview stages: loading, wrapping, computing, and submitted.
 */
const InterviewOverlay: React.FC<InterviewOverlayProps> = ({
    isCodingStarted,
    isInterviewActive,
    isInterviewLoading,
    isAgentConnected = false,
    interviewConcluded = false,
    candidateName = "Candidate",
    hasSubmitted = false,
}) => {
    /**
     * Derives the current stage based on interview state.
     */
    const derivedStage = useMemo(() => {
        if (interviewConcluded) return "submitted";
        if (isInterviewLoading && hasSubmitted) return "computing";
        if (isInterviewLoading) return "loading";
        if (hasSubmitted) return "wrapping";
        return null;
    }, [interviewConcluded, hasSubmitted, isInterviewLoading]);

    const [stage, setStage] = useState<string | null>(derivedStage);
    const [visible, setVisible] = useState<boolean>(true);
    const [computingMessageIndex, setComputingMessageIndex] = useState<number>(0);

    const computingMessages = [
        "Analyzing your performance",
        "Still working on it",
        "Running AI evaluations",
        "Almost there",
        "Finalizing your results"
    ];

    /**
     * Cross-fade between stages.
     */
    useEffect(() => {
        if (derivedStage === stage) return;
        setVisible(false);
        const t = setTimeout(() => {
            setStage(derivedStage);
            setVisible(true);
        }, 260);
        return () => clearTimeout(t);
    }, [derivedStage, stage]);

    /**
     * Rotate computing messages during the computing stage.
     */
    useEffect(() => {
        if (stage === "computing") {
            setComputingMessageIndex(0);
            const timer = setInterval(() => {
                setComputingMessageIndex((prevIndex) => {
                    if (prevIndex < computingMessages.length - 1) {
                        return prevIndex + 1;
                    }
                    return prevIndex;
                });
            }, 3500);
            return () => clearInterval(timer);
        } else {
            setComputingMessageIndex(0);
        }
    }, [stage, computingMessages.length]);

    if (!stage) return null;

    return (
        <>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
            <div className="absolute inset-0 z-20 bg-white/80 dark:bg-black/70 backdrop-blur-md flex items-center justify-center select-none transition-opacity duration-500 ease-out opacity-100">
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
                                waiting for the interviewer to finish the closing line…
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
                    ) : stage === "loading" ? (
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
                    ) : null}
                </div>
            </div>
        </>
    );
};

export default InterviewOverlay;
