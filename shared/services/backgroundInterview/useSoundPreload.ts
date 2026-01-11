/**
 * useSoundPreload Hook
 * Preloads and caches click and start-interview sounds.
 * Returns refs to audio elements and ready flag.
 */

import { useEffect, useRef, useState } from "react";
import { loadAndCacheSoundEffect } from "@/shared/utils/audioCache";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.BACKGROUND_INTERVIEW;

/**
 * Preload sound effects with caching. Returns refs to audio elements and ready status.
 */
export function useSoundPreload() {
  const clickSoundRef = useRef<HTMLAudioElement | null>(null);
  const startSoundRef = useRef<HTMLAudioElement | null>(null);
  const [soundsReady, setSoundsReady] = useState(false);

  useEffect(() => {
    // Skip if already loaded
    if (clickSoundRef.current && startSoundRef.current) {
      setSoundsReady(true);
      return;
    }

    log.info(LOG_CATEGORY, "[sounds] Starting preload...");
    Promise.all([
      loadAndCacheSoundEffect("/sounds/click-button.mp3", "click-button"),
      loadAndCacheSoundEffect("/sounds/start-interview.mp3", "start-interview"),
    ])
      .then(([clickSound, startSound]) => {
        clickSoundRef.current = clickSound;
        startSoundRef.current = startSound;
        setSoundsReady(true);
        log.info(LOG_CATEGORY, "[sounds] Preload complete");
      })
      .catch((err) => {
        console.error("[sounds] Preload failed:", err);
        setSoundsReady(true); // Continue anyway
      });
  }, []);

  return { clickSoundRef, startSoundRef, soundsReady };
}
