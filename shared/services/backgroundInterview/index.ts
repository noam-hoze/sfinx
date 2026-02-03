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

// Answer classification utilities and types
export {
  buildClassificationPrompt,
  isGibberishAnswer,
  isExactDontKnow,
  shouldIncrementRetryCounter,
  shouldMoveToNextQuestion,
  type AnswerType,
  type ClassifiedQuestionResponse,
  type ClassificationPromptParams
} from './answerClassification';