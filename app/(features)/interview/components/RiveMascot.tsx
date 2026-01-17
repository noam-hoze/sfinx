"use client";

import React, { useEffect } from "react";
import { useRive } from "@rive-app/react-webgl2";
import { MascotProvider, MascotClient, useMascot } from "@mascotbot-sdk/react";

/**
 * RiveMascot: Animated avatar with Mascot.bot viseme-based lip sync.
 * Uses Rive animation with Mascotbot SDK for lip sync.
 */
interface RiveMascotProps {
  className?: string;
  isSpeaking?: boolean;
}

const MascotContent: React.FC<{ isSpeaking: boolean }> = ({ isSpeaking }) => {
  const { rive, RiveComponent } = useMascot();

  useEffect(() => {
    if (rive) {
      const input = rive.stateMachineInputs("State Machine 1")?.[0];
      if (input) {
        input.value = isSpeaking;
      }
    }
  }, [isSpeaking, rive]);

  return <RiveComponent />;
};

const RiveMascot: React.FC<RiveMascotProps> = ({ className = "", isSpeaking = false }) => {
  const mascotId = "panda";
  
  // Mascotbot CDN URL for ready-made mascots
  const mascotSrc = `https://cdn.mascot.bot/mascots/${mascotId}.riv`;
  
  const rive = useRive({
    src: mascotSrc,
    autoplay: true,
  });

  return (
    <div className={className}>
      <MascotProvider>
        <MascotClient rive={rive}>
          <MascotContent isSpeaking={isSpeaking} />
        </MascotClient>
      </MascotProvider>
    </div>
  );
};

export default RiveMascot;
