/**
 * useAnnouncementGeneration Hook
 * Generates announcement text based on job title and fetches TTS audio blob.
 * Returns text, audio, and visemes for AnnouncementScreen component.
 */

import { useCallback } from "react";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import type { Viseme } from "@/shared/types/mascot";
import { convertPCMToWAV } from "@/shared/utils/audioConversion";

const LOG_CATEGORY = LOG_CATEGORIES.BACKGROUND_INTERVIEW;

interface AnnouncementResult {
  text: string;
  audioBlob: Blob | null;
  visemes?: Viseme[];
}

/**
 * Generate announcement text from job title and fetch TTS audio.
 * Uses mascot API if enabled (for visemes), otherwise falls back to regular TTS.
 * Returns announcement text, audio blob, and optional visemes (graceful fallback if TTS fails).
 */
export function useAnnouncementGeneration() {
  const generateAnnouncement = useCallback(async (jobTitle: string): Promise<AnnouncementResult> => {
    try {
      const announcement = `Hi! Welcome to your ${jobTitle} interview`;
      log.info(LOG_CATEGORY, "[announcement] Generated text:", announcement);

      const mascotEnabled = process.env.NEXT_PUBLIC_MASCOT_ENABLED === "true";

      // Fetch TTS audio (with visemes if mascot is enabled)
      log.info(LOG_CATEGORY, `[announcement] Generating ${mascotEnabled ? 'mascot' : 'TTS'} audio...`);
      let audioBlob: Blob | null = null;
      let visemes: Viseme[] | undefined = undefined;

      try {
        if (mascotEnabled) {
          // Use mascot API for visemes + audio
          const mascotResp = await fetch("/api/mascot/visemes-audio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: announcement }),
          });

          if (mascotResp.ok) {
            const data = await mascotResp.json();
            visemes = data.visemes;
            log.info(LOG_CATEGORY, "[announcement] Received", visemes?.length || 0, "visemes from API");

            // Convert PCM to WAV
            const wavBuffer = convertPCMToWAV(data.audioBase64);
            audioBlob = new Blob([wavBuffer], { type: "audio/wav" });
            log.info(LOG_CATEGORY, "[announcement] Mascot audio generated successfully, WAV size:", wavBuffer.byteLength);
          } else {
            console.warn("[announcement] Mascot API failed with status:", mascotResp.status);
          }
        } else {
          // Use regular TTS API
          const ttsResp = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: announcement }),
          });

          if (ttsResp.ok) {
            const audioBuffer = await ttsResp.arrayBuffer();
            audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
            log.info(LOG_CATEGORY, "[announcement] TTS generated successfully");
          } else {
            console.warn("[announcement] TTS failed with status:", ttsResp.status);
          }
        }
      } catch (err) {
        console.warn("[announcement] Error calling TTS/Mascot API:", err);
      }

      return { text: announcement, audioBlob, visemes };
    } catch (error) {
      log.error(LOG_CATEGORY, "[announcement] Unexpected error:", error);
      throw error;
    }
  }, []);

  return { generateAnnouncement };
}
