/**
 * Stage gate helper for advancing the Background stage based on confidence and question count.
 * Exposes a pure function to decide whether to advance and ensures single-transition idempotency.
 */

export interface BackgroundGateState {
    currentConfidence: number; // 0–100
    questionsAsked: number;
    transitioned: boolean;
}

export interface BackgroundGateDecision {
    shouldAdvance: boolean;
    reason: "threshold_not_met" | "min_questions_not_met" | "already_transitioned" | "ok";
}

/** Decide whether to advance the Background stage now. */
export function shouldAdvanceBackgroundStage(state: BackgroundGateState): BackgroundGateDecision {
    if (state.transitioned) return { shouldAdvance: false, reason: "already_transitioned" };
    if (state.questionsAsked < 3) return { shouldAdvance: false, reason: "min_questions_not_met" };
    if (state.currentConfidence >= 95) return { shouldAdvance: true, reason: "ok" };
    return { shouldAdvance: false, reason: "threshold_not_met" };
}
