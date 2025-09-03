"use client";

import React from "react";
import AvatarDisplay from "./AvatarDisplay";

interface AvatarManagerProps {
    className?: string;
    isSpeaking?: boolean;
}

const AvatarManager: React.FC<AvatarManagerProps> = ({
    className = "",
    isSpeaking = false,
}) => {
    return (
        <div className={`${className} flex flex-col justify-end h-full`}>
            {/* Header - moved to bottom */}
            <div className="mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
                    Sfinx AI Interviewer
                </h3>
            </div>

            {/* Avatar Display - takes full available space */}
            <div className="flex-1 min-h-0">
                <AvatarDisplay
                    className="w-full h-full"
                    isSpeaking={isSpeaking}
                />
            </div>

            {/* Status indicator - moved to very bottom */}
            <div className="mt-2 text-center pb-2">
                <div
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                        isSpeaking
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                >
                    <div
                        className={`w-2 h-2 rounded-full mr-2 ${
                            isSpeaking
                                ? "bg-green-500 animate-pulse"
                                : "bg-gray-400"
                        }`}
                    ></div>
                    {isSpeaking ? "Speaking" : "Ready"}
                </div>
            </div>
        </div>
    );
};

export default AvatarManager;
