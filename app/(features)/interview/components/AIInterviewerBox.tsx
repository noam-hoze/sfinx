"use client";

import React from "react";

interface AIInterviewerBoxProps {
    isActive: boolean;
}

const AIInterviewerBox: React.FC<AIInterviewerBoxProps> = ({ isActive }) => {
    return (
        <div
            className={`w-[350px] aspect-[4/3] rounded-xl overflow-hidden shadow-xl border-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-purple-50 to-blue-50 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isActive
                    ? "opacity-100 scale-100"
                    : "opacity-0 scale-[0.98] pointer-events-none"
            }`}
        >
            {/* Placeholder for future animation */}
        </div>
    );
};

export default AIInterviewerBox;
