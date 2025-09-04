"use client";

import React from "react";

interface AnimatedWaveformProps {
    isSpeaking: boolean;
    isInterviewActive?: boolean;
}

const AnimatedWaveform = ({
    isSpeaking,
    isInterviewActive = false,
}: AnimatedWaveformProps) => {
    // Create a more dynamic waveform pattern
    const barHeights = [12, 20, 28, 20, 12, 16, 24, 16];

    return (
        <div className="flex items-center justify-center space-x-0.5 py-3 mb-2">
            {barHeights.map((height, index) => (
                <div
                    key={index}
                    className={`w-1 rounded-full transition-all duration-300 ${
                        !isInterviewActive
                            ? "bg-gray-400 dark:bg-gray-500"
                            : isSpeaking
                            ? "bg-electric-blue animate-pulse"
                            : "bg-blue-300 dark:bg-blue-400"
                    }`}
                    style={{
                        height: `${height}px`,
                        opacity: !isInterviewActive
                            ? 0.3
                            : isSpeaking
                            ? 0.9
                            : 0.6,
                        animationDelay:
                            isInterviewActive && isSpeaking
                                ? `${index * 0.15}s`
                                : "0s",
                        animationDuration:
                            isInterviewActive && isSpeaking ? "0.8s" : "0s",
                    }}
                />
            ))}
        </div>
    );
};

export default AnimatedWaveform;
