/**
 * Background Interview Services
 * Modular, reusable services for background interview flow: preload, announcement, sounds, answer handling.
 * Used by the interview page flow (Constitution Principle II: Reuse-First) after retiring the
 * legacy /background-interview route.
*/

export { useBackgroundPreload } from "./useBackgroundPreload";
export { useAnnouncementGeneration } from "./useAnnouncementGeneration";
export { useSoundPreload } from "./useSoundPreload";
export { useBackgroundAnswerHandler } from "./useBackgroundAnswerHandler";
