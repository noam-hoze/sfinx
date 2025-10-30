/**
 * Types and constants for background-stage CONTROL evaluation.
 */

export type ControlPillars = {
    adaptability: number;
    creativity: number;
    reasoning: number;
};

export type ControlResult = {
    pillars: ControlPillars;
    rationale?: string;
    pillarRationales?: {
        adaptability?: string;
        creativity?: string;
        reasoning?: string;
    };
};

/**
 * Number of alternating turns (user/assistant) to include in Chat Completions
 * evaluation context. Can be overridden by callers.
 */
export const CONTROL_CONTEXT_TURNS = 30;


