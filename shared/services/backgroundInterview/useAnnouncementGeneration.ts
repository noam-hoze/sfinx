/**
 * useAnnouncementGeneration Hook
 * Generates announcement text based on job title and fetches TTS audio blob.
 * Returns both text and audio for AnnouncementScreen component.
 * Uses localStorage caching to avoid redundant TTS API calls.
 */

import { useCallback } from "react";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import { cacheBlob, getCachedBlob } from "@/shared/utils/audioCache";

const LOG_CATEGORY = LOG_CATEGORIES.BACKGROUND_INTERVIEW;

interface AnnouncementResult {
  text: string;
  audioBlob: Blob | null;
}

/**
 * Generate announcement text from job title and fetch TTS audio.
 * Returns announcement text and optional audio blob (graceful fallback if TTS fails).
 * Caches TTS audio in localStorage for repeat visits.
 */
export function useAnnouncementGeneration() {
  const generateAnnouncement = useCallback(async (jobTitle: string): Promise<AnnouncementResult> => {
    try {
      const announcement = `Hi! Welcome to your ${jobTitle} interview`;
      log.info(LOG_CATEGORY, "[announcement] Generated text:", announcement);

      // Check cache first
      const cacheId = `announcement-tts-${jobTitle.toLowerCase().replace(/\s+/g, "-")}`;
      const cachedBlob = getCachedBlob(cacheId);
      if (cachedBlob) {
        log.info(LOG_CATEGORY, "[announcement] TTS loaded from cache");
        return { text: announcement, audioBlob: cachedBlob };
      }

      // Fetch TTS audio
      log.info(LOG_CATEGORY, "[announcement] Generating TTS...");
      let audioBlob: Blob | null = null;

      try {
        const ttsResp = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: announcement }),
        });

        if (ttsResp.ok) {
          const audioBuffer = await ttsResp.arrayBuffer();
          audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
          log.info(LOG_CATEGORY, "[announcement] TTS generated successfully");

          // Cache for next time
          cacheBlob(cacheId, audioBlob).catch(() => {});
        } else {
          console.warn("[announcement] TTS failed with status:", ttsResp.status);
        }
      } catch (err) {
        console.warn("[announcement] Error calling TTS API:", err);
      }

      return { text: announcement, audioBlob };
    } catch (error) {
      log.error(LOG_CATEGORY, "[announcement] Unexpected error:", error);
      throw error;
    }
  }, []);

  return { generateAnnouncement };
}
