"use client";

import React, { useRef, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { setActiveCaption } from "shared/state/slices/cpsSlice";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import {
    DefaultVideoLayout,
    defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";

type Props = {
    videoUrl?: string | null;
    jumpToTime?: number;
    jumpKey?: number;
    duration?: number;
    caption?: string | null;
    paused?: boolean;
};

export default function EvidenceReel({
    videoUrl,
    jumpToTime,
    jumpKey,
    duration,
    caption = null,
    paused = false,
}: Props) {
    const playerRef = useRef<any>(null);
    const dispatch = useDispatch();
    const [isFadingOut, setIsFadingOut] = useState(false);

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

    // Auto-hide caption after 8 seconds with fade out
    useEffect(() => {
        if (!caption) {
            setIsFadingOut(false);
            return;
        }
        
        // Start fade out at 7.5 seconds
        const fadeTimer = setTimeout(() => {
            setIsFadingOut(true);
        }, 7500);
        
        // Remove caption at 8 seconds
        const hideTimer = setTimeout(() => {
            dispatch(setActiveCaption(null));
        }, 8000);

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(hideTimer);
        };
    }, [caption, dispatch]);
    
    const handleCloseCaption = () => {
        setIsFadingOut(true);
        setTimeout(() => {
            dispatch(setActiveCaption(null));
        }, 300);
    };



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
                >
                    <MediaProvider />
                    <DefaultVideoLayout icons={defaultLayoutIcons} />
                </MediaPlayer>

                {caption && (
                    <div 
                        key={caption}
                        className={`absolute bottom-16 left-1/2 -translate-x-1/2 w-[90%] px-6 py-3 pr-12 rounded-xl bg-black/50 backdrop-blur-md border border-white/5 shadow-2xl transition-opacity duration-300 ${isFadingOut ? 'opacity-0' : 'opacity-100 animate-fade-in-scale'}`}
                    >
                        <button
                            onClick={handleCloseCaption}
                            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors duration-200"
                            aria-label="Close caption"
                        >
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <p className="text-white text-sm sm:text-base font-medium text-center leading-relaxed tracking-wide">
                            {caption}
                        </p>
                    </div>
                )}
                
                <style jsx>{`
                    @keyframes fade-in-scale {
                        from {
                            opacity: 0;
                            transform: translate(-50%, 0.5rem) scale(0.95);
                        }
                        to {
                            opacity: 1;
                            transform: translate(-50%, 0) scale(1);
                        }
                    }
                    .animate-fade-in-scale {
                        animation: fade-in-scale 0.2s ease-out;
                    }
                `}</style>

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
