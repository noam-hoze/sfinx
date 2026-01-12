"use client";

/**
 * HeyGenAvatar renders the streaming avatar video or an optional fallback image.
 */

import React, { useEffect, useRef } from "react";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import type { HeyGenStatus } from "./hooks/useHeyGenStreamingAvatar";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEW_UI;

type HeyGenAvatarProps = {
  mediaStream: MediaStream | null;
  status: HeyGenStatus;
  isMuted: boolean;
  showFallback: boolean;
};

/**
 * Manages attaching the HeyGen stream to a video element.
 */
function useHeyGenVideo(mediaStream: MediaStream | null, isMuted: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (!mediaStream) {
      videoRef.current.srcObject = null;
      return;
    }
    videoRef.current.srcObject = mediaStream;
    log.info(LOG_CATEGORY, "[HeyGen] Stream attached");
  }, [mediaStream]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = isMuted;
    videoRef.current.volume = isMuted ? 0 : 1;
  }, [isMuted]);

  return videoRef;
}

/**
 * Renders a fallback avatar when HeyGen is unavailable.
 */
function AvatarFallback() {
  return (
    <img
      src="/sfinx-avatar-nobg.png"
      alt="Sfinx"
      className="w-full h-full object-contain"
    />
  );
}

/**
 * Renders the HeyGen video stream with a connection overlay.
 */
function HeyGenVideo({
  status,
  videoRef,
}: {
  status: HeyGenStatus;
  videoRef: React.RefObject<HTMLVideoElement>;
}) {
  return (
    <div className="w-full h-full relative">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
      {status !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <span className="text-sm text-gray-600">Connecting avatar...</span>
        </div>
      )}
    </div>
  );
}

/**
 * Displays the HeyGen stream in a video element with loading states.
 */
export default function HeyGenAvatar({
  mediaStream,
  status,
  isMuted,
  showFallback,
}: HeyGenAvatarProps) {
  const videoRef = useHeyGenVideo(mediaStream, isMuted);

  if (showFallback) {
    return <AvatarFallback />;
  }

  return <HeyGenVideo status={status} videoRef={videoRef} />;
}
