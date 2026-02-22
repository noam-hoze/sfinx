"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import OpenAI from "openai";
import RiveMascot from "app/(features)/interview/components/RiveMascot";
import { loadAndCacheSoundEffect } from "@/shared/utils/audioCache";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

interface WarmupData {
  applicationId: string;
  sessionId: string;
}

interface PreloadState {
  isMascotReady: boolean;
  warmupData: WarmupData | null;
  warmupLoading: boolean;
  clickSoundRef: React.RefObject<HTMLAudioElement | null>;
  startSoundRef: React.RefObject<HTMLAudioElement | null>;
  soundsReady: boolean;
  openaiClient: OpenAI | null;
}

const InterviewPreloadContext = createContext<PreloadState>({
  isMascotReady: false,
  warmupData: null,
  warmupLoading: false,
  clickSoundRef: { current: null },
  startSoundRef: { current: null },
  soundsReady: false,
  openaiClient: null,
});

export function InterviewPreloadProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [isMascotReady, setIsMascotReady] = useState(false);
  const [warmupData, setWarmupData] = useState<WarmupData | null>(null);
  const [warmupLoading, setWarmupLoading] = useState(false);
  const [soundsReady, setSoundsReady] = useState(false);
  const [openaiClient, setOpenaiClient] = useState<OpenAI | null>(null);
  const clickSoundRef = useRef<HTMLAudioElement | null>(null);
  const startSoundRef = useRef<HTMLAudioElement | null>(null);
  const hasWarmupStarted = useRef(false);
  const hasSoundsStarted = useRef(false);

  // Initialize OpenAI client once
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (apiKey && !openaiClient) {
      setOpenaiClient(new OpenAI({ apiKey, dangerouslyAllowBrowser: true }));
    }
  }, [openaiClient]);

  // Pre-load mascot on authentication
  useEffect(() => {
    if (status === "authenticated" && !isMascotReady) {
      console.log("[InterviewPreload] User authenticated, triggering mascot pre-load");
    }
  }, [status, isMascotReady]);

  // Pre-create warmup DB records on authentication
  useEffect(() => {
    if (status !== "authenticated" || hasWarmupStarted.current || warmupData) return;
    hasWarmupStarted.current = true;
    setWarmupLoading(true);

    log.info(LOG_CATEGORY, "[InterviewPreload] Creating warmup shell records...");
    fetch("/api/interviews/warmup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Warmup API returned ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setWarmupData({ applicationId: data.applicationId, sessionId: data.sessionId });
        log.info(LOG_CATEGORY, "[InterviewPreload] Warmup shell records created:", data);
      })
      .catch((err) => {
        log.warn(LOG_CATEGORY, "[InterviewPreload] Warmup failed (will fallback):", err);
        // Graceful fallback: interview page will create records itself
      })
      .finally(() => {
        setWarmupLoading(false);
      });
  }, [status, warmupData]);

  // Pre-load sound effects on authentication
  useEffect(() => {
    if (status !== "authenticated" || hasSoundsStarted.current) return;
    hasSoundsStarted.current = true;

    log.info(LOG_CATEGORY, "[InterviewPreload] Preloading sound effects...");
    Promise.all([
      loadAndCacheSoundEffect("/sounds/click-button.mp3", "click-button"),
      loadAndCacheSoundEffect("/sounds/start-interview.mp3", "start-interview"),
    ])
      .then(([clickSound, startSound]) => {
        clickSoundRef.current = clickSound;
        startSoundRef.current = startSound;
        setSoundsReady(true);
        log.info(LOG_CATEGORY, "[InterviewPreload] Sound effects preloaded");
      })
      .catch((err) => {
        console.error("[InterviewPreload] Sound preload failed:", err);
        setSoundsReady(true); // Continue anyway
      });
  }, [status]);

  return (
    <InterviewPreloadContext.Provider
      value={{
        isMascotReady,
        warmupData,
        warmupLoading,
        clickSoundRef,
        startSoundRef,
        soundsReady,
        openaiClient,
      }}
    >
      {children}
      {/* Hidden mascot renderer to pre-load Rive file */}
      {status === "authenticated" && !isMascotReady && (
        <div className="absolute opacity-0 pointer-events-none" aria-hidden="true">
          <RiveMascot
            onReady={() => {
              console.log("[InterviewPreload] Mascot Rive file loaded");
              setIsMascotReady(true);
            }}
          />
        </div>
      )}
    </InterviewPreloadContext.Provider>
  );
}

export const useInterviewPreload = () => useContext(InterviewPreloadContext);
