"use client";

import React, { useState, useEffect } from "react";
import RiveMascot from "./RiveMascot";
import type { Viseme } from "@/shared/types/mascot";

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
    visemes?: Viseme[];
}

const AIInterviewerBox: React.FC<AIInterviewerBoxProps> = ({ 
    isActive, 
    hasGlow, 
    mode = "talking",
    intent,
    isArriving = false,
    visemes = []
}) => {
    const [previousMode, setPreviousMode] = useState<"talking" | "idle">(mode);
    const [isInfoHovered, setIsInfoHovered] = useState(false);
    const mascotEnabled = process.env.NEXT_PUBLIC_MASCOT_ENABLED === "true";

    // Track mode changes for animation direction
    useEffect(() => {
        if (mode !== previousMode) {
            setPreviousMode(mode);
        }
    }, [mode, previousMode]);

    return (
        <div className={`relative w-[350px] aspect-[4/3] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            !isArriving ? (isActive ? "opacity-100 scale-100" : "opacity-0 scale-[0.98] pointer-events-none") : ""
        }`}>
            {/* Outer ring layer - no clipping */}
            {!isArriving && hasGlow && (
                <div className={`absolute inset-0 rounded-xl ring-4 ring-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.5)] pointer-events-none ${
                    mode === "talking" ? "animate-breathing-glow" : ""
                }`} />
            )}
            
            {/* Inner content layer - with overflow clipping */}
            <div className={`w-full h-full ${
                !isArriving ? "rounded-xl overflow-hidden shadow-xl border-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-purple-50 to-blue-50" : ""
            }`}>
                <div className="w-full h-full relative p-6">
                {/* Sfinx avatar - animates between announcement, center, and corner */}
                <div
                    className={`transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                        isArriving
                            ? 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48'
                            // Commented out corner animation: mode === "idle" && intent ? 'absolute top-4 right-4 w-16 h-16'
                            : 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40'
                    }`}
                >
                    {mascotEnabled ? (
                        <RiveMascot 
                            className={`w-full h-full ${isArriving ? 'animate-in fade-in duration-700' : ''}`}
                            visemes={visemes}
                            isPlaying={mode === "talking"}
                        />
                    ) : (
                        <img 
                            src="/sfinx-avatar-nobg.png" 
                            alt="Sfinx" 
                            className={`w-full h-full object-contain ${isArriving ? 'animate-in fade-in duration-700' : ''}`}
                        />
                    )}
                </div>

                {/* Info icon with hover tooltip */}
                {mode === "idle" && intent && (
                    <div 
                        className="absolute top-4 right-4"
                        onMouseEnter={() => setIsInfoHovered(true)}
                        onMouseLeave={() => setIsInfoHovered(false)}
                    >
                        {/* Info icon button */}
                        <div className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center cursor-pointer transition-all duration-200 ease-out hover:scale-110 hover:shadow-lg">
                            <svg 
                                className="w-5 h-5 text-gray-600" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                    strokeWidth={2} 
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                                />
                            </svg>
                        </div>
                        
                        {/* Tooltip */}
                        <div 
                            className={`absolute top-full right-0 mt-2 w-72 bg-gray-900/70 backdrop-blur-md text-white text-sm px-4 py-3 rounded-lg shadow-xl pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                                isInfoHovered 
                                    ? 'opacity-100 translate-y-0' 
                                    : 'opacity-0 -translate-y-2 pointer-events-none'
                            }`}
                        >
                            {intent}
                            {/* Tooltip arrow */}
                            <div className={`absolute bottom-full right-3 -mb-1 transition-opacity duration-300 ${
                                isInfoHovered ? 'opacity-100' : 'opacity-0'
                            }`}>
                                <div className="w-2 h-2 bg-gray-900/70 transform rotate-45"></div>
                            </div>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </div>
    );
};

export default AIInterviewerBox;
