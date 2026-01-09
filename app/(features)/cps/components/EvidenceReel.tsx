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
    jumpKey?: number;
    duration?: number;
    chapters?: any[];
    paused?: boolean;
};

export default function EvidenceReel({
    videoUrl,
    jumpToTime,
    jumpKey,
    duration,
    chapters = [],
    paused = false,
}: Props) {
    const playerRef = useRef<any>(null);

    useEffect(() => {
        if (playerRef.current && typeof jumpToTime === "number") {
            if (playerRef.current.remote) {
                playerRef.current.remote.seek(jumpToTime);
                playerRef.current.remote.play();
            } else if (playerRef.current.currentTime !== undefined) {
                playerRef.current.currentTime = jumpToTime;
                if (playerRef.current.play) {
                    const playPromise = playerRef.current.play();
                    if (playPromise !== undefined) {
                        playPromise.catch((error: any) => {
                            // Ignore auto-play errors (e.g. not allowed or not ready)
                            console.warn("[EvidenceReel] Auto-play prevented:", error);
                        });
                    }
                }
            }
        }
    }, [jumpToTime, jumpKey]);

    // Handle paused state
    useEffect(() => {
        if (playerRef.current) {
            if (paused) {
                if (playerRef.current.remote) {
                    playerRef.current.remote.pause();
                } else if (playerRef.current.pause) {
                    playerRef.current.pause();
                }
            } else {
                // Don't auto-play when unpaused - let user control it
            }
        }
    }, [paused]);

    const formatVttTime = (seconds: number) => {
        const date = new Date(0);
        date.setSeconds(seconds);
        return date.toISOString().substr(11, 12);
    };

    const subtitleTrackUrl = useMemo(() => {
        let vtt = "WEBVTT\n\n";
        
        // Group captions by time range, merging text for duplicates
        const captionsByTimeRange = new Map<string, string[]>();
        
        chapters.forEach((chapter) => {
            if (chapter.captions) {
                chapter.captions.forEach((caption: any) => {
                    const timeRange = `${caption.startTime}-${caption.endTime}`;
                    if (!captionsByTimeRange.has(timeRange)) {
                        captionsByTimeRange.set(timeRange, []);
                    }
                    captionsByTimeRange.get(timeRange)!.push(caption.text);
                });
            }
        });
        
        // Generate VTT cues with merged text for duplicate time ranges
        Array.from(captionsByTimeRange.entries()).forEach(([timeRange, texts]) => {
            const [start, end] = timeRange.split('-').map(Number);
            vtt += `${formatVttTime(start)} --> ${formatVttTime(end)}\n`;
            
            // Format merged text: add period to first sentence if needed, then newline, then next sentence
            const formattedText = texts.map((text, i) => {
                if (i === texts.length - 1) return text;
                // Add period if the text doesn't end with punctuation
                return text.match(/[.!?]$/) ? text : text + '.';
            }).join('\n');
            
            vtt += formattedText + '\n\n';
        });
        
        const blob = new Blob([vtt], { type: "text/vtt" });
        return URL.createObjectURL(blob);
    }, [chapters]);

    // Build a Blob URL for WebVTT chapters
    const chaptersUrl = useMemo(() => {
        let vtt = "WEBVTT\n\n";
        
        // Group chapters by startTime only (Vidstack uses startTime as key)
        const chaptersByStartTime = new Map<number, { titles: string[], endTime: number | null }>();
        
        chapters.forEach((chapter) => {
            const start = chapter.startTime;
            if (!chaptersByStartTime.has(start)) {
                chaptersByStartTime.set(start, { titles: [], endTime: chapter.endTime });
            }
            chaptersByStartTime.get(start)!.titles.push(chapter.title);
            // Use the latest endTime if multiple chapters share the same startTime
            if (chapter.endTime) {
                chaptersByStartTime.get(start)!.endTime = chapter.endTime;
            }
        });
        
        // Generate VTT chapters with merged titles for duplicate startTimes
        Array.from(chaptersByStartTime.entries()).forEach(([start, data]) => {
            const end = data.endTime || (start + 10); // Default 10s if no endTime
            vtt += `${formatVttTime(start)} --> ${formatVttTime(end)}\n`;
            vtt += data.titles.join(' + ') + '\n\n';
        });
        
        const blob = new Blob([vtt], { type: "text/vtt" });
        return URL.createObjectURL(blob);
    }, [chapters]);

    // Cleanup blob URL on unmount
    useEffect(
        () => () => {
            if (chaptersUrl) URL.revokeObjectURL(chaptersUrl);
        },
        [chaptersUrl]
    );

    if (!videoUrl)
        return <div className="aspect-video bg-gray-50 rounded-xl" />;

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
