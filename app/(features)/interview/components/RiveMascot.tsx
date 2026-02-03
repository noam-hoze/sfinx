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
  const previousVisemesRef = useRef<Viseme[]>([]);
  const previousIsPlayingRef = useRef<boolean>(false);
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

    handlePlayback(playback, visemes, isPlaying, previousVisemesRef, previousIsPlayingRef);

    // Update refs for next comparison
    previousVisemesRef.current = visemes;
    previousIsPlayingRef.current = isPlaying;
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
 * Only resets when actually needed (stopping playback or changing visemes)
 */
function handlePlayback(
  playback: any,
  visemes: Viseme[],
  isPlaying: boolean,
  previousVisemesRef: React.MutableRefObject<Viseme[]>,
  previousIsPlayingRef: React.MutableRefObject<boolean>
): void {
  const previousVisemes = previousVisemesRef.current;
  const previousIsPlaying = previousIsPlayingRef.current;

  // Check if visemes actually changed (by reference or length)
  const visemesChanged = previousVisemes !== visemes || previousVisemes.length !== visemes.length;

  // #region agent log
  fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'HANDLE_PLAYBACK',isPlaying,previousIsPlaying,visemesCount:visemes.length,visemesChanged})}).catch(()=>{});
  // #endregion

  // Case 1: Starting playback with new visemes
  if (isPlaying && visemes.length > 0 && (!previousIsPlaying || visemesChanged)) {
    // Reset only if we were previously playing something else
    if (previousIsPlaying || previousVisemes.length > 0) {
      playback.pause();
      playback.reset();
    }

    playback.add(visemes);
    playback.play();
    // #region agent log
    fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'PLAYBACK_START',visemesCount:visemes.length})}).catch(()=>{});
    // #endregion
  }
  // Case 2: Stopping playback
  else if (!isPlaying && previousIsPlaying) {
    playback.pause();
    playback.reset();
    // #region agent log
    fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'PLAYBACK_STOP'})}).catch(()=>{});
    // #endregion
  }
  // Case 3: Already playing same visemes - do nothing (avoid unnecessary resets)
  else if (isPlaying && !visemesChanged) {
    // #region agent log
    fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'PLAYBACK_CONTINUE',note:'Same visemes, no reset needed'})}).catch(()=>{});
    // #endregion
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
    src: "/realisticFemale.riv",
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
