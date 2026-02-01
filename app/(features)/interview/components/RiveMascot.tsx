"use client";

import React, { useEffect, useRef } from "react";
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
  const instanceId = useRef(Math.random().toString(36).substr(2, 9));
  const renderCount = useRef(0);
  renderCount.current++;

  // Log on every effect trigger with detailed data
  useEffect(() => {
    const logData = {
      instanceId: instanceId.current,
      renderCount: renderCount.current,
      isPlaying,
      visemesCount: visemes.length,
      firstVisemeOffset: visemes[0]?.offset ?? null,
      lastVisemeOffset: visemes[visemes.length - 1]?.offset ?? null,
      visemesSample: visemes.slice(0, 3),
      speakingState: playback?.getSpeakingState?.() ?? 'unknown',
      timestamp: performance.now(),
      playbackExists: !!playback
    };

    // #region agent log
    fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'EFFECT',data:logData})}).catch(()=>{});
    // #endregion

    handlePlayback(playback, visemes, isPlaying);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, visemes]);  // Removed playback - its reference changes every render but points to same instance

  // Cleanup effect to detect unmount/remount
  useEffect(() => {
    // #region agent log
    fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'MOUNT',instanceId:instanceId.current})}).catch(()=>{});
    // #endregion

    return () => {
      // #region agent log
      fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'UNMOUNT',instanceId:instanceId.current})}).catch(()=>{});
      // #endregion

      // Explicit cleanup on unmount
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
  // #region agent log
  fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'HANDLE_PLAYBACK',isPlaying,visemesCount:visemes.length})}).catch(()=>{});
  // #endregion

  // Always stop current playback first to prevent overlap between questions
  playback.pause();
  playback.reset();

  if (isPlaying && visemes.length > 0) {
    playback.add(visemes);
    playback.play();
    // #region agent log
    fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'PLAYBACK_START',visemesCount:visemes.length})}).catch(()=>{});
    // #endregion
  }
  // When !isPlaying or visemes.length === 0, playback stays stopped (already paused/reset above)
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
