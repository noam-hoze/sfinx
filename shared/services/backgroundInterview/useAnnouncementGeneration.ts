/**
 * useAnnouncementGeneration Hook
 * Generates announcement text based on job title and fetches TTS audio blob.
 * Returns both text and audio for AnnouncementScreen component.
 */

import { useCallback } from "react";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.BACKGROUND_INTERVIEW;

interface AnnouncementResult {
  text: string;
  audioBlob: Blob | null;
}

interface AnnouncementOptions {
  shouldGenerateAudio: boolean;
}

/**
 * Generate announcement text from job title and fetch TTS audio.
 * Returns announcement text and optional audio blob (graceful fallback if TTS fails).
 */
export function useAnnouncementGeneration() {
  const generateAnnouncement = useCallback(async (
    jobTitle: string,
    options: AnnouncementOptions
  ): Promise<AnnouncementResult> => {
    try {
      const announcement = `Hi! Welcome to your ${jobTitle} interview`;
      log.info(LOG_CATEGORY, "[announcement] Generated text:", announcement);

      // Fetch TTS audio
      let audioBlob: Blob | null = null;

      if (options.shouldGenerateAudio) {
        log.info(LOG_CATEGORY, "[announcement] Generating TTS...");
        audioBlob = await fetchAnnouncementAudio(announcement);
      }

      return { text: announcement, audioBlob };
    } catch (error) {
      log.error(LOG_CATEGORY, "[announcement] Unexpected error:", error);
      throw error;
    }
  }, []);

  return { generateAnnouncement };
}

/**
 * Requests the TTS audio blob for the announcement text.
 */
async function fetchAnnouncementAudio(text: string): Promise<Blob | null> {
  try {
    const ttsResp = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (ttsResp.ok) {
      const audioBuffer = await ttsResp.arrayBuffer();
      log.info(LOG_CATEGORY, "[announcement] TTS generated successfully");
      return new Blob([audioBuffer], { type: "audio/mpeg" });
    }
    log.warn(LOG_CATEGORY, "[announcement] TTS failed with status:", ttsResp.status);
    return null;
  } catch (error) {
    log.warn(LOG_CATEGORY, "[announcement] Error calling TTS API:", error);
    return null;
  }
}
