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
}) => {
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeChapter, setActiveChapter] = useState(chapters[0]?.id);

    // Handle video jumping when jumpToTime changes
    useEffect(() => {
        if (jumpToTime !== undefined && jumpToTime !== currentTime) {
            setCurrentTime(jumpToTime);
            setIsPlaying(false); // Pause when jumping

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
    }, [jumpToTime, chapters, currentTime]);

    const totalDuration = chapters[chapters.length - 1]?.endTime || 330;

    const handleChapterClick = (chapter: VideoChapter) => {
        setCurrentTime(chapter.startTime);
        setActiveChapter(chapter.id);
    };

    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
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
                <div className="aspect-video bg-gradient-to-br from-slate-900 via-gray-800 to-slate-900 flex items-center justify-center relative">
                    <div className="text-center text-white">
                        <div className="w-20 h-20 bg-white/30 hover:bg-white/40 rounded-full flex items-center justify-center mb-4 mx-auto cursor-pointer transition-all duration-200 hover:scale-105 shadow-lg">
                            <span className="text-3xl">
                                {isPlaying ? "⏸️" : "▶️"}
                            </span>
                        </div>
                        <p className="text-lg font-medium">Session Recording</p>
                        <p className="text-sm opacity-75">
                            Gal&apos;s coding session
                        </p>
                    </div>
                </div>

                {/* Video Controls */}
                <div className="bg-gray-900 p-6">
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={handlePlayPause}
                            className="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-105 shadow-lg"
                        >
                            <span className="text-lg">
                                {isPlaying ? "⏸️" : "▶️"}
                            </span>
                        </button>

                        <div className="flex-1 mx-4">
                            <div className="relative">
                                <div className="w-full h-2 bg-white/20 rounded-full cursor-pointer">
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
                                    className={`flex-shrink-0 p-2 rounded-lg text-xs text-left transition-all duration-200 min-w-[100px] ${
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
