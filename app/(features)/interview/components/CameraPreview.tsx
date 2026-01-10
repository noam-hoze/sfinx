"use client";

import React from "react";

interface CameraPreviewProps {
    isCameraOn: boolean;
    videoRef: React.RefObject<HTMLVideoElement>;
    hasGlow: boolean;
}

const CameraPreview: React.FC<CameraPreviewProps> = ({
    isCameraOn,
    videoRef,
    hasGlow,
}) => {
    return (
        <div
            className={`w-[350px] aspect-[4/3] rounded-xl overflow-hidden shadow-xl border-2 border-gray-200 dark:border-gray-700 bg-black transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isCameraOn
                    ? "opacity-100 scale-100"
                    : "opacity-0 scale-[0.98] pointer-events-none"
            } ${
                hasGlow
                    ? "ring-4 ring-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.6)]"
                    : ""
            }`}
        >
            <video
                ref={videoRef}
                className="w-full h-full object-cover [transform:scaleX(-1)]"
                muted
                playsInline
                autoPlay
            />
        </div>
    );
};

export default CameraPreview;
