"use client";

import React from "react";

interface AnimatedWaveformProps {
    isSpeaking: boolean;
}

const AnimatedWaveform = ({ isSpeaking }: AnimatedWaveformProps) => {
    // Create a more dynamic waveform pattern
    const barHeights = [12, 20, 28, 20, 12, 16, 24, 16];

    return (
        <div className="flex items-center justify-center space-x-0.5 py-3 mb-2">
            {barHeights.map((height, index) => (
                <div
                    key={index}
                    className={`w-1 rounded-full transition-all duration-300 ${
                        isSpeaking
                            ? "bg-electric-blue animate-pulse"
                            : "bg-gray-300 dark:bg-gray-600"
                    }`}
                    style={{
                        height: `${height}px`,
                        opacity: isSpeaking ? 0.9 : 0.4,
                        animationDelay: isSpeaking ? `${index * 0.15}s` : "0s",
                        animationDuration: isSpeaking ? "0.8s" : "0s",
                    }}
                />
            ))}
        </div>
    );
};

export default AnimatedWaveform;
