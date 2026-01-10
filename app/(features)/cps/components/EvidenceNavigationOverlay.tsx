"use client";

import React from "react";

interface EvidenceLink {
    timestamp: number;
    category: string;
    caption?: string;
}

interface EvidenceNavigationOverlayProps {
    evidenceLinks: EvidenceLink[];
    currentIndex: number;
    onNavigate: (index: number) => void;
}

/**
 * Navigation overlay for evidence clips - shows at top center of video player
 */
export default function EvidenceNavigationOverlay({
    evidenceLinks,
    currentIndex,
    onNavigate,
}: EvidenceNavigationOverlayProps) {
    if (evidenceLinks.length === 0) return null;

    const handlePrevious = () => {
        if (currentIndex > 0) {
            onNavigate(currentIndex - 1);
        }
    };

    const handleNext = () => {
        if (currentIndex < evidenceLinks.length - 1) {
            onNavigate(currentIndex + 1);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${String(secs).padStart(2, "0")}`;
    };

    const currentEvidence = evidenceLinks[currentIndex];

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous evidence"
            >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            <div className="flex flex-col items-center px-3 min-w-[180px]">
                <div className="text-white text-xs font-semibold">
                    {currentIndex + 1} / {evidenceLinks.length}
                </div>
                <div className="text-white/70 text-[10px] font-medium">
                    {currentEvidence?.category}
                </div>
                <div className="text-white/50 text-[10px] font-mono">
                    {formatTime(currentEvidence?.timestamp || 0)}
                </div>
            </div>

            <button
                onClick={handleNext}
                disabled={currentIndex === evidenceLinks.length - 1}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next evidence"
            >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    );
}
