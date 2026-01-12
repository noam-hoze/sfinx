"use client";

/**
 * Hook for managing HeyGen Streaming Avatar sessions and speech.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { StreamingAvatarSDK } from "@heygen/streaming-avatar-sdk";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import { HeyGenClientConfig } from "../heygenConfig";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEW_UI;

export type HeyGenStatus = "idle" | "starting" | "ready" | "error";

type HeyGenSessionResult = {
  mediaStream?: MediaStream;
  stream?: MediaStream;
  videoStream?: MediaStream;
};

/**
 * Creates a HeyGen SDK client from config.
 */
function createHeyGenClient(config: HeyGenClientConfig): StreamingAvatarSDK {
  return new StreamingAvatarSDK({
    apiKey: config.apiKey as string,
    avatarId: config.avatarId as string,
  });
}

/**
 * Returns missing config fields for HeyGen initialization.
 */
function getMissingConfig(config: HeyGenClientConfig): string[] {
  const missing: string[] = [];
  if (!config.apiKey) missing.push("apiKey");
  if (!config.avatarId) missing.push("avatarId");
  if (!config.voiceId) missing.push("voiceId");
  return missing;
}

/**
 * Logs missing config and sets an error status.
 */
function handleMissingConfig(missing: string[], setStatus: (status: HeyGenStatus) => void) {
  log.error(LOG_CATEGORY, "[HeyGen] Missing config:", missing);
  setStatus("error");
}

/**
 * Extracts a media stream from a HeyGen session response.
 */
function getSessionStream(session: HeyGenSessionResult | null): MediaStream | null {
  if (!session) return null;
  if (session.mediaStream) return session.mediaStream;
  if (session.stream) return session.stream;
  if (session.videoStream) return session.videoStream;
  return null;
}

/**
 * Initializes a HeyGen session and returns its media stream.
 */
async function initializeSession(
  config: HeyGenClientConfig,
  avatarRef: MutableRefObject<StreamingAvatarSDK | null>
): Promise<MediaStream | null> {
  const avatar = createHeyGenClient(config);
  avatarRef.current = avatar;
  return startHeyGenSession(avatar, config.voiceId as string);
}

/**
 * Starts a HeyGen session and returns the media stream.
 */
async function startHeyGenSession(
  avatar: StreamingAvatarSDK,
  voiceId: string
): Promise<MediaStream | null> {
  const session = (await avatar.startSession({
    voice: {
      provider: "elevenlabs",
      voiceId,
    },
  })) as HeyGenSessionResult;
  return getSessionStream(session);
}

/**
 * Resolves a callable stop method for the HeyGen SDK instance.
 */
function getStopMethod(avatar: StreamingAvatarSDK | null): (() => Promise<void>) | null {
  if (!avatar) return null;
  const anyAvatar = avatar as StreamingAvatarSDK & {
    stopSession?: () => Promise<void>;
    stop?: () => Promise<void>;
  };
  return anyAvatar.stopSession ?? anyAvatar.stop ?? null;
}

/**
 * Manages the HeyGen streaming session lifecycle and speech requests.
 */
export function useHeyGenStreamingAvatar(
  config: HeyGenClientConfig,
  shouldStart: boolean
) {
  const [status, setStatus] = useState<HeyGenStatus>("idle");
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const avatarRef = useRef<StreamingAvatarSDK | null>(null);
  const statusRef = useRef<HeyGenStatus>("idle");

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const startSession = useCallback(async () => {
    if (!config.enabled) return;
    if (statusRef.current === "starting" || statusRef.current === "ready") return;
    const missing = getMissingConfig(config);
    if (missing.length > 0) {
      handleMissingConfig(missing, setStatus);
      return;
    }
    setStatus("starting");
    try {
      const stream = await initializeSession(config, avatarRef);
      if (!stream) {
        log.error(LOG_CATEGORY, "[HeyGen] Session missing media stream");
        setStatus("error");
        return;
      }
      setMediaStream(stream);
      setStatus("ready");
      log.info(LOG_CATEGORY, "[HeyGen] Session started");
    } catch (error) {
      log.error(LOG_CATEGORY, "[HeyGen] Failed to start session:", error);
      setStatus("error");
    }
  }, [config]);

  const stopSession = useCallback(async () => {
    const avatar = avatarRef.current;
    if (!avatar) return;
    const stop = getStopMethod(avatar);
    if (!stop) {
      log.warn(LOG_CATEGORY, "[HeyGen] Stop method unavailable");
      return;
    }
    await stop();
    avatarRef.current = null;
    setMediaStream(null);
    setStatus("idle");
    log.info(LOG_CATEGORY, "[HeyGen] Session stopped");
  }, []);

  const speak = useCallback(async (text: string) => {
    const avatar = avatarRef.current;
    if (!avatar) {
      throw new Error("HeyGen session not started");
    }
    log.info(LOG_CATEGORY, "[HeyGen] Speaking text", { length: text.length });
    await avatar.speak(text);
  }, []);

  const stopSpeech = useCallback(async () => {
    const avatar = avatarRef.current as StreamingAvatarSDK & {
      stopSpeaking?: () => Promise<void>;
      stopSpeech?: () => Promise<void>;
      stop?: () => Promise<void>;
    };
    if (!avatar) return;
    const stop = avatar.stopSpeaking ?? avatar.stopSpeech ?? avatar.stop;
    if (!stop) {
      log.warn(LOG_CATEGORY, "[HeyGen] Speech stop method unavailable");
      return;
    }
    await stop.call(avatar);
  }, []);

  useEffect(() => {
    if (!config.enabled || !shouldStart) return;
    startSession();
    return () => {
      stopSession().catch((error) => {
        log.error(LOG_CATEGORY, "[HeyGen] Failed to stop session:", error);
      });
    };
  }, [config.enabled, shouldStart, startSession, stopSession]);

  return { status, mediaStream, startSession, stopSession, speak, stopSpeech };
}
