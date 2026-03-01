"use client";

import React, { useEffect, useRef } from "react";
import { useRive } from "@rive-app/react-webgl2";
import { MascotProvider, MascotClient, useMascot, useMascotPlayback } from "@mascotbot-sdk/react";
import type { Viseme } from "@/shared/types/mascot";

/**
 * RiveMascot: Animated bear avatar with Mascotbot lip sync
 * Uses realisticFemale.riv with InLesson state machine for lip-sync animation
 */
interface RiveMascotProps {
  className?: string;
  visemes?: Viseme[];
  isPlaying?: boolean;
  onReady?: () => void;
}

/**
 * Inner component that drives lip-sync with viseme data
 */
const MascotContent: React.FC<{ visemes?: Viseme[]; isPlaying?: boolean }> = ({
  visemes = [],
  isPlaying = false
}) => {
  const { RiveComponent } = useMascot();
  const playback = useMascotPlayback();
  useEffect(() => {
    handlePlayback(playback, visemes, isPlaying);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, visemes]);  // Removed playback - its reference changes every render but points to same instance

  // Cleanup effect to detect unmount/remount
  useEffect(() => {
    return () => {
      playback?.pause();
      playback?.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // Only run on mount/unmount, not on playback reference changes

  return <RiveComponent />;
};

/**
 * Handles lip-sync playback state
 */
function handlePlayback(
  playback: any,
  visemes: Viseme[],
  isPlaying: boolean
): void {
  playback.pause();
  playback.reset();

  if (isPlaying && visemes.length > 0) {
    playback.add(visemes);
    playback.play();
  }
  // When !isPlaying or visemes.length === 0, playback stays stopped (already paused/reset above)
}

/**
 * Main RiveMascot component
 */
const RiveMascot: React.FC<RiveMascotProps> = ({
  className = "",
  visemes = [],
  isPlaying = false,
  onReady
}) => {
  const rive = useRive({
    src: "/realisticFemale.riv",
    artboard: "Character",
    stateMachines: "InLesson",
    autoplay: true,
  });

  useEffect(() => {
    if (rive.rive && onReady) {
      onReady();
    }
  }, [rive.rive, onReady]);

  return (
    <div className={className}>
      <MascotProvider>
        <MascotClient rive={rive}>
          <MascotContent visemes={visemes} isPlaying={isPlaying} />
        </MascotClient>
      </MascotProvider>
    </div>
  );
};

export default RiveMascot;
