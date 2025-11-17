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
                    className="rounded-full bg-purple-600 p-3 text-white shadow-lg hover:bg-purple-700 transition-colors flex-shrink-0"
                    title={isDebugVisible ? "Hide Debug Panel" : "Show Debug Panel"}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
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
