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

/**
 * Generate announcement text from job title and fetch TTS audio.
 * Returns announcement text and optional audio blob (graceful fallback if TTS fails).
 */
export function useAnnouncementGeneration() {
  const generateAnnouncement = useCallback(async (jobTitle: string): Promise<AnnouncementResult> => {
    const requestId = globalThis.crypto.randomUUID();
    try {
      const announcement = `Hi! Welcome to your ${jobTitle} interview`;
      log.info(LOG_CATEGORY, "[announcement] Generated text", {
        requestId,
        jobTitle,
        announcementLength: announcement.length,
      });

      // Fetch TTS audio
      log.info(LOG_CATEGORY, "[announcement] Generating TTS", {
        requestId,
      });
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
          log.info(LOG_CATEGORY, "[announcement] TTS generated successfully", {
            requestId,
            audioBytes: audioBuffer.byteLength,
          });
        } else {
          log.warn(LOG_CATEGORY, "[announcement] TTS failed with status", {
            requestId,
            status: ttsResp.status,
          });
        }
      } catch (err) {
        log.warn(LOG_CATEGORY, "[announcement] Error calling TTS API", {
          requestId,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }

      return { text: announcement, audioBlob };
    } catch (error) {
      log.error(LOG_CATEGORY, "[announcement] Unexpected error", {
        requestId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, []);

  return { generateAnnouncement };
}
