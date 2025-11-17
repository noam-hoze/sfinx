"use client";

import React from "react";
import { Camera, CameraOff } from "lucide-react";

interface HeaderControlsProps {
    isCameraOn: boolean;
    onToggleCamera: () => void;
    isCodingStarted: boolean;
    hasSubmitted: boolean;
    timeLeft: number;
    formatTime: (seconds: number) => string;
    automaticMode: boolean;
    isInterviewActive: boolean;
    onStartCoding: () => void;
    onSubmit: () => void;
    onTestEvaluation?: () => void;
    isDebugModeEnabled: boolean;
    isDebugVisible: boolean;
    onToggleDebug: () => void;
    codingDurationSeconds: number;
}

const HeaderControls: React.FC<HeaderControlsProps> = ({
    isCameraOn,
    onToggleCamera,
    isCodingStarted,
    hasSubmitted,
    timeLeft,
    formatTime,
    automaticMode,
    isInterviewActive,
    onStartCoding,
    onSubmit,
    onTestEvaluation,
    isDebugModeEnabled,
    isDebugVisible,
    onToggleDebug,
    codingDurationSeconds,
}) => {
    const codingDurationLabel = formatTime(codingDurationSeconds);

    return (
        <div className="flex items-center space-x-4">
            {isDebugModeEnabled && (
                <button
                    onClick={onToggleDebug}
                    className={`px-3 py-2 rounded-full text-sm font-medium tracking-wide transition-all duration-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
                        isDebugVisible
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                            : "bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800/60 dark:text-gray-200 dark:hover:bg-gray-700"
                    }`}
                    title={isDebugVisible ? "Hide debug panel" : "Show debug panel"}
                >
                    Debug
                </button>
            )}
            {/* Camera toggle */}
            <button
                onClick={onToggleCamera}
                className={`p-2.5 rounded-full transition-all duration-200 hover:shadow-sm ${
                    isCameraOn
                        ? "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/10 dark:text-green-400 dark:hover:bg-green-900/20"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-700/70"
                }`}
                title={isCameraOn ? "Turn camera off" : "Turn camera on"}
            >
                {isCameraOn ? (
                    <CameraOff className="w-5 h-5" />
                ) : (
                    <Camera className="w-5 h-5" />
                )}
            </button>

            {/* Timer Display */}
            {isCodingStarted && (
                <div
                    className={`px-3 py-2 rounded-full font-mono text-sm font-semibold transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        timeLeft < 300
                            ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                    }`}
                >
                    {formatTime(timeLeft)}
                </div>
            )}

            {/* Test Evaluation Button */}
            {(isCodingStarted || hasSubmitted) && onTestEvaluation && (
                <button
                    onClick={onTestEvaluation}
                    disabled={!isInterviewActive && !isCodingStarted}
                    className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-sm bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/10 dark:text-blue-400 dark:hover:bg-blue-900/20 ${
                        (!isInterviewActive && !isCodingStarted)
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                    }`}
                    title="Test OpenAI evaluation (debug only)"
                >
                    Test Evaluation
                </button>
            )}

            {/* Coding Control Button */}
            {automaticMode ? (
                (isCodingStarted || hasSubmitted) && (
                    <button
                        onClick={onSubmit}
                        disabled={hasSubmitted || (!isInterviewActive && !isCodingStarted)}
                        className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-sm ${"bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/10 dark:text-green-400 dark:hover:bg-green-900/20"} ${
                            hasSubmitted || (!isInterviewActive && !isCodingStarted)
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                        }`}
                        title={"Submit your solution"}
                    >
                        Submit
                    </button>
                )
            ) : (
                <button
                    onClick={(isCodingStarted || hasSubmitted) ? onSubmit : onStartCoding}
                    disabled={hasSubmitted || (!isInterviewActive && !isCodingStarted)}
                    className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-sm ${
                        (isCodingStarted || hasSubmitted)
                            ? "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/10 dark:text-green-400 dark:hover:bg-green-900/20"
                            : "bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/10 dark:text-purple-400 dark:hover:bg-purple-900/20"
                    } ${
                        hasSubmitted || (!isInterviewActive && !isCodingStarted)
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                    }`}
                    title={
                        (isCodingStarted || hasSubmitted)
                            ? "Submit your solution"
                            : isInterviewActive
                            ? `Start ${codingDurationLabel} coding timer`
                            : "Start interview first"
                    }
                >
                    {(isCodingStarted || hasSubmitted) ? "Submit" : "Start Coding"}
                </button>
            )}
        </div>
    );
};

export default HeaderControls;
