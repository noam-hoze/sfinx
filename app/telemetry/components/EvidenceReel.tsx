"use client";

import React, { useState, useEffect } from "react";
import { VideoChapter, EvidenceClip } from "../../../lib/interview/types";
import { formatTime, formatDuration } from "../../../lib/telemetry/mockData";

interface EvidenceReelProps {
    chapters: VideoChapter[];
    evidence: EvidenceClip[];
    jumpToTime?: number;
    onChapterClick?: (timestamp: number) => void;
}

const EvidenceReel: React.FC<EvidenceReelProps> = ({
    chapters,
    evidence,
    jumpToTime,
    onChapterClick,
}) => {
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeChapter, setActiveChapter] = useState(chapters[0]?.id);
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const lastChapterUpdate = React.useRef<number>(0);

    // Handle video jumping when jumpToTime changes
    useEffect(() => {
        if (
            jumpToTime !== undefined &&
            jumpToTime !== currentTime &&
            videoRef.current
        ) {
            videoRef.current.currentTime = jumpToTime;
            setCurrentTime(jumpToTime);

            // Update active chapter based on jumped time
            const currentChapter = chapters.find(
                (chapter) =>
                    jumpToTime >= chapter.startTime &&
                    jumpToTime < chapter.endTime
            );
            if (currentChapter) {
                setActiveChapter(currentChapter.id);
            }
        }
    }, [jumpToTime, chapters]);

    const totalDuration = chapters[chapters.length - 1]?.endTime || 330;

    const handleChapterClick = (chapter: VideoChapter) => {
        if (videoRef.current) {
            videoRef.current.currentTime = chapter.startTime;
            setCurrentTime(chapter.startTime);
            setActiveChapter(chapter.id);
            // Notify parent component to jump to this timestamp
            onChapterClick?.(chapter.startTime);
        }
    };

    const handlePlayPause = () => {
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play().catch(console.error);
            } else {
                videoRef.current.pause();
            }
        }
    };

    const handleTimeUpdate = (newTime: number) => {
        setCurrentTime(newTime);
        // Update active chapter based on current time
        const currentChapter = chapters.find(
            (chapter) =>
                newTime >= chapter.startTime && newTime < chapter.endTime
        );
        if (currentChapter) {
            setActiveChapter(currentChapter.id);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-xl border border-gray-300 overflow-hidden">
            {/* Video Player Section */}
            <div className="relative">
                <div
                    className="aspect-video bg-black relative cursor-pointer"
                    onClick={handlePlayPause}
                >
                    <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        controls={false}
                        preload="metadata"
                        playsInline
                        onTimeUpdate={(e) => {
                            const video = e.target as HTMLVideoElement;
                            const newTime = Math.floor(video.currentTime);

                            // Only update if time changed by at least 1 second
                            if (newTime !== Math.floor(currentTime)) {
                                setCurrentTime(video.currentTime);

                                // Update active chapter based on current time
                                const currentChapter = chapters.find(
                                    (chapter) =>
                                        video.currentTime >=
                                            chapter.startTime &&
                                        video.currentTime < chapter.endTime
                                );
                                if (
                                    currentChapter &&
                                    currentChapter.id !== activeChapter
                                ) {
                                    setActiveChapter(currentChapter.id);
                                }
                            }
                        }}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onLoadedMetadata={(e) => {
                            const video = e.target as HTMLVideoElement;
                            console.log(
                                "Video loaded:",
                                video.duration,
                                "seconds"
                            );
                        }}
                        onError={(e) => {
                            const video = e.target as HTMLVideoElement;
                            console.error("Video error:", video.error);
                            console.error("Video src:", video.currentSrc);
                        }}
                        onLoadStart={() => {
                            console.log("Video load started");
                        }}
                        onCanPlay={() => {
                            console.log("Video can play");
                        }}
                    >
                        <source src="/gal-interview.mp4" type="video/mp4" />
                        Your browser does not support the video tag.
                    </video>

                    {/* Custom Play/Pause Overlay */}
                    {!isPlaying && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px]">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handlePlayPause();
                                }}
                                className="w-16 h-16 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-all duration-300 ease-out hover:scale-105 shadow-2xl shadow-black/20 backdrop-blur-sm border border-white/10"
                            >
                                <div className="w-0 h-0 border-l-[16px] border-l-white border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent ml-1"></div>
                            </button>
                        </div>
                    )}
                </div>

                {/* Video Controls */}
                <div className="bg-gray-900 p-6">
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={handlePlayPause}
                            className="w-10 h-10 bg-white/15 hover:bg-white/25 rounded-full flex items-center justify-center text-white transition-all duration-300 ease-out hover:scale-105 shadow-xl shadow-black/10 backdrop-blur-sm border border-white/5"
                        >
                            {isPlaying ? (
                                <div className="flex gap-0.5">
                                    <div className="w-1 h-4 bg-white rounded-sm"></div>
                                    <div className="w-1 h-4 bg-white rounded-sm"></div>
                                </div>
                            ) : (
                                <div className="w-0 h-0 border-l-[8px] border-l-white border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent ml-0.5"></div>
                            )}
                        </button>

                        <div className="flex-1 mx-4">
                            <div className="relative">
                                <div
                                    className="w-full h-2 bg-white/20 rounded-full cursor-pointer"
                                    onClick={(e) => {
                                        if (videoRef.current) {
                                            const rect =
                                                e.currentTarget.getBoundingClientRect();
                                            const clickX =
                                                e.clientX - rect.left;
                                            const percentage =
                                                clickX / rect.width;
                                            const newTime =
                                                percentage * totalDuration;
                                            videoRef.current.currentTime =
                                                newTime;
                                        }
                                    }}
                                >
                                    <div
                                        className="h-2 bg-red-500 rounded-full transition-all duration-300 shadow-sm"
                                        style={{
                                            width: `${
                                                (currentTime / totalDuration) *
                                                100
                                            }%`,
                                        }}
                                    ></div>
                                </div>

                                {/* Chapter markers on progress bar */}
                                {chapters.map((chapter, index) => (
                                    <div
                                        key={chapter.id}
                                        className="absolute top-0 w-2 h-2 bg-yellow-400 rounded-full transform -translate-x-1 -translate-y-0.5 shadow-sm cursor-pointer hover:bg-yellow-300 transition-colors"
                                        style={{
                                            left: `${
                                                (chapter.startTime /
                                                    totalDuration) *
                                                100
                                            }%`,
                                        }}
                                    ></div>
                                ))}
                            </div>
                        </div>

                        <div className="text-white text-sm font-mono">
                            {formatTime(currentTime)} /{" "}
                            {formatTime(totalDuration)}
                        </div>
                    </div>

                    {/* Chapter Navigation */}
                    <div className="relative">
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {chapters.map((chapter) => (
                                <button
                                    key={chapter.id}
                                    onClick={() => handleChapterClick(chapter)}
                                    className={`flex-shrink-0 p-2 rounded-lg text-xs text-left transition-all duration-300 ease-out min-w-[100px] ${
                                        activeChapter === chapter.id
                                            ? "bg-blue-600 text-white shadow-lg"
                                            : "bg-white/10 text-white/80 hover:bg-white/20 hover:shadow-md"
                                    }`}
                                >
                                    <div className="font-medium truncate">
                                        {chapter.title}
                                    </div>
                                    <div className="opacity-75 text-[10px]">
                                        {formatTime(chapter.startTime)}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EvidenceReel;
