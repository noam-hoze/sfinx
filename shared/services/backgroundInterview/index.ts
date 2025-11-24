/**
 * Background Interview Services
 * Modular, reusable services for background interview flow: preload, announcement, sounds, answer handling.
 * Used by both /background-interview and /interview pages (Constitution Principle II: Reuse-First).
 */

export { useBackgroundPreload } from "./useBackgroundPreload";
export { useAnnouncementGeneration } from "./useAnnouncementGeneration";
export { useSoundPreload } from "./useSoundPreload";
export { useBackgroundAnswerHandler } from "./useBackgroundAnswerHandler";
