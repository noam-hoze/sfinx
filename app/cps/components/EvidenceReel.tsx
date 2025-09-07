"use client";

import React, { useRef, useEffect, useMemo, useState } from "react";
import { MediaPlayer, MediaProvider, Track } from "@vidstack/react";
import {
    DefaultVideoLayout,
    defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";

type Props = {
    videoUrl?: string | null;
    jumpToTime?: number;
    duration?: number;
    chapters?: Array<{
        id: string;
        title: string;
        startTime: number;
    }>;
    evidence?: any[]; // Keep for backward compatibility but not used
    onChapterClick?: (timestamp: number) => void; // Keep for backward compatibility but not used
};

export default function EvidenceReel({
    videoUrl,
    jumpToTime,
    duration,
    chapters,
}: Props) {
    const playerRef = useRef<any>(null);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        if (
            playerRef.current &&
            typeof jumpToTime === "number" &&
            jumpToTime !== currentTime
        ) {
            // Try to seek using the player's remote control
            if (playerRef.current.remote) {
                playerRef.current.remote.seek(jumpToTime);
            } else if (playerRef.current.currentTime !== undefined) {
                // Fallback: directly set currentTime
                playerRef.current.currentTime = jumpToTime;
            }
            setCurrentTime(jumpToTime);
        }
    }, [jumpToTime, currentTime]);

    const handleTimeUpdate = (time: number) => {
        setCurrentTime(time);
    };

    // Build a Blob URL for WebVTT chapters
    const chaptersUrl = useMemo(() => {
        console.log("Chapters data:", chapters);
        console.log("Duration:", duration);

        if (!chapters || chapters.length === 0) return undefined;

        // Validate chapters data
        const validChapters = chapters.filter(
            (chapter) =>
                chapter &&
                typeof chapter.startTime === "number" &&
                !isNaN(chapter.startTime) &&
                chapter.startTime >= 0 &&
                chapter.title
        );

        if (validChapters.length === 0) return undefined;

        const formatTime = (s: number) => {
            // Ensure s is a valid finite number
            const time = Math.max(0, Math.min(s, 86400)); // Clamp between 0 and 24 hours
            const h = Math.floor(time / 3600);
            const m = Math.floor((time % 3600) / 60);
            const sec = Math.floor(time % 60);
            const ms = Math.floor((time % 1) * 1000);
            // Always include hours for consistent WebVTT format
            return `${String(h).padStart(2, "0")}:${String(m).padStart(
                2,
                "0"
            )}:${String(sec).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
        };

        let vtt = "WEBVTT\n\n";
        for (let i = 0; i < validChapters.length; i++) {
            const start = formatTime(validChapters[i].startTime);
            let endTime: number;

            if (i < validChapters.length - 1) {
                // Use next chapter's start time
                endTime = Math.max(
                    validChapters[i].startTime + 1,
                    validChapters[i + 1].startTime
                );
            } else {
                // Last chapter - use duration or add 30 seconds
                endTime =
                    duration &&
                    !isNaN(duration) &&
                    duration > validChapters[i].startTime
                        ? duration
                        : validChapters[i].startTime + 30;
            }

            const end = formatTime(endTime);
            vtt += `${start} --> ${end}\n${validChapters[i].title}\n\n`;
        }
        console.log("Generated VTT content:", vtt);
        const blob = new Blob([vtt], { type: "text/vtt" });
        return URL.createObjectURL(blob);
    }, [chapters, duration]);

    // Cleanup blob URL on unmount
    useEffect(
        () => () => {
            if (chaptersUrl) URL.revokeObjectURL(chaptersUrl);
        },
        [chaptersUrl]
    );

    if (!videoUrl)
        return <div className="aspect-video bg-gray-900 rounded-xl" />;

    return (
        <div className="bg-white rounded-xl shadow-xl border border-gray-300 overflow-hidden">
            <div className="relative w-full">
                <MediaPlayer
                    className="vds-theme"
                    src={videoUrl}
                    streamType="on-demand"
                    playsInline
                    preload="metadata"
                    crossOrigin="anonymous"
                    ref={playerRef}
                    onTimeUpdate={(e) => handleTimeUpdate(e.currentTime)}
                >
                    <MediaProvider />

                    {/* Inline chapters track (no public file needed) */}
                    <Track
                        kind="chapters"
                        src={URL.createObjectURL(
                            new Blob(
                                [
                                    `WEBVTT

00:00.000 --> 00:18.000
Intro

00:18.000 --> 04:42.000
Coding
`,
                                ],
                                { type: "text/vtt" }
                            )
                        )}
                        default
                    />

                    {/* Vidstack UI */}
                    <DefaultVideoLayout icons={defaultLayoutIcons} />
                </MediaPlayer>

                {duration && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-sm font-mono z-10 pointer-events-none">
                        Duration: {Math.floor(duration / 60)}:
                        {String(duration % 60).padStart(2, "0")}
                    </div>
                )}
            </div>
        </div>
    );
}
