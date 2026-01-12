"use client";

import React, { useState, useEffect } from "react";

/**
 * AIInterviewerBox: Displays interviewer state with animations and evaluation intent.
 * Shows talking mode with pulse animation or idle mode with listening focus.
 */
interface AIInterviewerBoxProps {
    isActive: boolean;
    hasGlow: boolean;
    mode?: "talking" | "idle";
    intent?: string;
    isArriving?: boolean;
}

const AIInterviewerBox: React.FC<AIInterviewerBoxProps> = ({ 
    isActive, 
    hasGlow, 
    mode = "talking",
    intent,
    isArriving = false
}) => {
    const [previousMode, setPreviousMode] = useState<"talking" | "idle">(mode);

    // Track mode changes for animation direction
    useEffect(() => {
        if (mode !== previousMode) {
            setPreviousMode(mode);
        }
    }, [mode, previousMode]);

    return (
        <div
            className={`w-[350px] aspect-[4/3] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                !isArriving ? `rounded-xl overflow-hidden shadow-xl border-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-purple-50 to-blue-50 ${
                    isActive
                        ? "opacity-100 scale-100"
                        : "opacity-0 scale-[0.98] pointer-events-none"
                } ${
                    hasGlow
                        ? "ring-4 ring-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.6)]"
                        : ""
                } ${
                    mode === "talking" && hasGlow
                        ? "animate-breathing"
                        : ""
                }` : ""
            }`}
        >
            <div className="w-full h-full relative p-6">
                {/* Sfinx avatar - animates between announcement, center, and corner */}
                <div 
                    className={`transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                        isArriving
                            ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 z-50'
                            : mode === "idle" && intent 
                                ? 'absolute top-4 right-4 w-16 h-16' 
                                : 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40'
                    }`}
                >
                    <img 
                        src="/sfinx-avatar-nobg.png" 
                        alt="Sfinx" 
                        className="w-full h-full object-contain"
                    />
                </div>

                {/* Intent text - fades in after Sfinx reaches corner */}
                {mode === "idle" && intent && (
                    <div className="flex gap-3 items-start pt-2 animate-intent-fade-in">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-1">
                            <svg 
                                className="w-5 h-5 text-purple-600" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                    strokeWidth={2} 
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                                />
                            </svg>
                        </div>
                        <p className="text-sm leading-relaxed text-gray-700 font-medium pr-20">
                            {intent}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIInterviewerBox;
