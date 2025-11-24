/**
 * useAnnouncementGeneration Hook
 * Generates announcement text based on job title and fetches TTS audio blob.
 * Returns both text and audio for AnnouncementScreen component.
 */

import { useCallback } from "react";

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
    try {
      const announcement = `Hi! Welcome to your ${jobTitle} interview`;
      console.log("[announcement] Generated text:", announcement);

      // Fetch TTS audio
      console.log("[announcement] Generating TTS...");
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
          console.log("[announcement] TTS generated successfully");
        } else {
          console.warn("[announcement] TTS failed with status:", ttsResp.status);
        }
      } catch (err) {
        console.warn("[announcement] Error calling TTS API:", err);
      }

      return { text: announcement, audioBlob };
    } catch (error) {
      console.error("[announcement] Unexpected error:", error);
      throw error;
    }
  }, []);

  return { generateAnnouncement };
}
