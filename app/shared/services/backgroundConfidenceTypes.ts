/**
 * Types and constants for background-stage CONTROL evaluation.
 */

export type ControlPillars = {
    adaptability: number;
    creativity: number;
    reasoning: number;
};

export type ControlResult = {
    overallConfidence: number; // 0–100
    pillars: ControlPillars;
    readyToProceed: boolean;
};

/**
 * Number of alternating turns (user/assistant) to include in Chat Completions
 * evaluation context. Can be overridden by callers.
 */
export const CONTROL_CONTEXT_TURNS = 10;


