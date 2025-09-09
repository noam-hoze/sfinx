"use client";

import React from "react";

interface CameraPreviewProps {
    isCameraOn: boolean;
    videoRef: React.RefObject<HTMLVideoElement>;
}

const CameraPreview: React.FC<CameraPreviewProps> = ({
    isCameraOn,
    videoRef,
}) => {
    return (
        <div
            className={`absolute bottom-4 right-4 w-56 h-40 rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 bg-black transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isCameraOn
                    ? "opacity-100 translate-y-0 scale-100"
                    : "opacity-0 translate-y-2 scale-[0.98] pointer-events-none"
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
