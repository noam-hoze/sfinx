"use client";

import React from "react";

interface AIInterviewerBoxProps {
    isActive: boolean;
    hasGlow: boolean;
}

const AIInterviewerBox: React.FC<AIInterviewerBoxProps> = ({ isActive, hasGlow }) => {
    return (
        <div
            className={`w-[350px] aspect-[4/3] rounded-xl overflow-hidden shadow-xl border-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-purple-50 to-blue-50 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isActive
                    ? "opacity-100 scale-100"
                    : "opacity-0 scale-[0.98] pointer-events-none"
            } ${
                hasGlow
                    ? "ring-4 ring-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.6)]"
                    : ""
            }`}
        >
            {/* Placeholder for future animation */}
        </div>
    );
};

export default AIInterviewerBox;
