"use client";

import React, { useEffect } from "react";
import { useRive } from "@rive-app/react-webgl2";
import { MascotProvider, MascotClient, useMascot, useMascotPlayback } from "@mascotbot-sdk/react";
import type { Viseme } from "@/shared/types/mascot";

/**
 * RiveMascot: Animated bear avatar with Mascotbot lip sync
 * Uses bear.riv with InLesson state machine for lip-sync animation
 */
interface RiveMascotProps {
  className?: string;
  visemes?: Viseme[];
  isPlaying?: boolean;
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
  }, [isPlaying, visemes, playback]);

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
  if (isPlaying && visemes.length > 0) {
    playback.reset();
    playback.add(visemes);
    playback.play();
  } else if (!isPlaying) {
    playback.pause();
    playback.reset();
  }
}

/**
 * Main RiveMascot component
 */
const RiveMascot: React.FC<RiveMascotProps> = ({ 
  className = "", 
  visemes = [],
  isPlaying = false 
}) => {
  const rive = useRive({
    src: "/bear.riv",
    artboard: "Character",
    stateMachines: "InLesson",
    autoplay: true,
  });

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
