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
    evidence?: any[]; // Keep for backward compatibility but not used
    onChapterClick?: (timestamp: number) => void; // Keep for backward compatibility but not used
};

export default function EvidenceReel({
    videoUrl,
    jumpToTime,
    duration,
}: Props) {
    const playerRef = useRef<any>(null);
    const lastJumpTimeRef = useRef<number | null>(null);

    useEffect(() => {
        if (
            playerRef.current &&
            typeof jumpToTime === "number" &&
            jumpToTime !== lastJumpTimeRef.current
        ) {
            // Try to seek using the player's remote control
            if (playerRef.current.remote) {
                playerRef.current.remote.seek(jumpToTime);
            } else if (playerRef.current.currentTime !== undefined) {
                // Fallback: directly set currentTime
                playerRef.current.currentTime = jumpToTime;
            }
            lastJumpTimeRef.current = jumpToTime;
        }
    }, [jumpToTime]); // Only depend on jumpToTime, not currentTime

    const subtitleTrackUrl = useMemo(() => {
        const vtt = `WEBVTT

00:38.000 --> 00:45.000
The user verifies that useState is working correctly

02:07.000 --> 02:16.000
The user checks if the list is displaying

04:00.000 --> 04:06.000
The user checks if the list is displaying and gets an error

04:20.000 --> 04:26.000
The user fixes the error


`;
        const blob = new Blob([vtt], { type: "text/vtt" });
        return URL.createObjectURL(blob);
    }, []);

    // Build a Blob URL for WebVTT chapters
    const chaptersUrl = useMemo(() => {
        const vtt = `WEBVTT

00:00.000 --> 00:18.000
Intro

00:18.000 --> 00:40.000
1st Iteration

00:40.000 --> 02:16.000
2nd Iteration

02:16.000 --> 04:05.000
3rd Iteration

04:05.000 --> 04:42.000
4th Iteration
`;
        const blob = new Blob([vtt], { type: "text/vtt" });
        return URL.createObjectURL(blob);
    }, []);

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
                    data-captions
                >
                    <MediaProvider />

                    {/* Inline chapters track (no public file needed) */}
                    <Track kind="chapters" src={chaptersUrl} default />

                    {/* Demo subtitles track */}
                    <Track
                        kind="subtitles"
                        src={subtitleTrackUrl}
                        label="English"
                        language="en"
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
