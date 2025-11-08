/**
 * Minimal Redux-style store for chat and recording state (no external deps).
 * Sync dispatch guarantees: message insert completes before subscribers run next logic.
 */
export type ChatSpeaker = "user" | "ai";

export type ChatMessage = {
    id: string;
    text: string;
    speaker: ChatSpeaker;
    timestamp: number;
};

export type InterviewStage =
    | "greeting"
    | "background"
    | "coding"
    | "submission"
    | "wrapup";

import { initState as initScorerState, update as scorerUpdate, computeWeight } from "@/shared/services/weightedMean/scorer";
import type { AllTraitState } from "@/shared/services/weightedMean/types";

type PendingReplyContext = {
    reason?: string;
    stage?: InterviewStage;
    since: number;
};

export type InterviewChatState = {
    messages: ChatMessage[];
    isRecording: boolean;
    stage: InterviewStage;
    pendingReply: boolean;
    pendingReplyContext?: PendingReplyContext;
    // Background stage fields
    background: {
        confidence: number; // 0–100
        pillars?: { adaptability: number; creativity: number; reasoning: number };
        rationales?: {
            overall?: string;
            adaptability?: string;
            creativity?: string;
            reasoning?: string;
        };
        aggPillars?: { adaptability: number; creativity: number; reasoning: number };
        aggConfidence?: number;
        samples?: number;
        questionsAsked: number;
        transitioned: boolean;
        transitionedAt?: number;
        scorer?: AllTraitState;
        coverage?: { A: boolean; C: boolean; R: boolean };
        // Guard state
        startedAtMs?: number;
        consecutiveUselessAnswers?: number;
        reason?: "timebox" | "useless_answers" | "gate";
        timeboxMs?: number;
    };
};

type Action =
    | { type: "ADD_MESSAGE"; payload: { text: string; speaker: ChatSpeaker } }
    | { type: "CLEAR" }
    | { type: "SET_RECORDING"; payload: boolean }
    | { type: "SET_STAGE"; payload: InterviewStage }
    | { type: "BG_SET_CONFIDENCE"; payload: number }
    | {
          type: "BG_SET_CONTROL_RESULT";
          payload: {
              confidence: number;
              pillars?: { adaptability: number; creativity: number; reasoning: number };
              rationales?: {
                  overall?: string;
                  adaptability?: string;
                  creativity?: string;
                  reasoning?: string;
              };
          };
      }
    | {
          type: "BG_ACCUMULATE_CONTROL_RESULT";
          payload: { pillars: { adaptability: number; creativity: number; reasoning: number } };
      }
    | { type: "BG_INC_QUESTIONS" }
    | { type: "BG_MARK_TRANSITION" }
    | { type: "BG_GUARD_START_TIMER" }
    | { type: "BG_GUARD_SET_REASON"; payload: { reason: "timebox" | "useless_answers" | "gate" } }
    | { type: "BG_GUARD_SET_TIMEBOX"; payload: { timeboxMs?: number } }
    | {
          type: "SET_PENDING_REPLY";
          payload: { pending: boolean; reason?: string; stage?: InterviewStage };
      };

function reducer(
    state: InterviewChatState,
    action: Action
): InterviewChatState {
    switch (action.type) {
        case "ADD_MESSAGE": {
            const msg: ChatMessage = {
                id:
                    typeof crypto !== "undefined" && (crypto as any).randomUUID
                        ? (crypto as any).randomUUID()
                        : `${Date.now()}-${Math.random()}`,
                text: action.payload.text,
                speaker: action.payload.speaker,
                timestamp: Date.now(),
            };
            return { ...state, messages: [...state.messages, msg] };
        }
        case "CLEAR":
            return { ...state, messages: [] };
        case "SET_RECORDING":
            return { ...state, isRecording: action.payload };
        case "SET_STAGE":
            return { ...state, stage: action.payload };
        case "BG_SET_CONFIDENCE":
            return {
                ...state,
                background: { ...state.background, confidence: action.payload },
            };
        case "BG_SET_CONTROL_RESULT":
            return {
                ...state,
                background: {
                    ...state.background,
                    confidence: action.payload.confidence,
                    pillars: action.payload.pillars,
                    rationales: action.payload.rationales,
                },
            };
        case "BG_ACCUMULATE_CONTROL_RESULT": {
            // Use latest pillars directly (no averaging)
            const latest = action.payload.pillars;
            const isZeroTriplet =
                (latest?.adaptability ?? 0) === 0 &&
                (latest?.creativity ?? 0) === 0 &&
                (latest?.reasoning ?? 0) === 0;

            // Update scorer state once per CONTROL result using normalized ratings and unit weight,
            // but SKIP updates when value==0 (no evidence)
            let scorer = state.background.scorer || initScorerState();
            const a = Math.max(0, Math.min(1, latest.adaptability / 100));
            const c = Math.max(0, Math.min(1, latest.creativity / 100));
            const r = Math.max(0, Math.min(1, latest.reasoning / 100));
            const wA = computeWeight(1, a, 1, 1, 1);
            const wC = computeWeight(1, c, 1, 1, 1);
            const wR = computeWeight(1, r, 1, 1, 1);
            if (wA > 0) scorer = scorerUpdate(scorer, { trait: "A", r: a, w: wA }).state;
            if (wC > 0) scorer = scorerUpdate(scorer, { trait: "C", r: c, w: wC }).state;
            if (wR > 0) scorer = scorerUpdate(scorer, { trait: "R", r: r, w: wR }).state;

            const coveragePrev = state.background.coverage || { A: false, C: false, R: false };
            const coverage = {
                A: coveragePrev.A || a > 0,
                C: coveragePrev.C || c > 0,
                R: coveragePrev.R || r > 0,
            };

            const prevConsecutive = state.background.consecutiveUselessAnswers || 0;
            const nextConsecutive = isZeroTriplet ? prevConsecutive + 1 : 0;

            return {
                ...state,
                background: {
                    ...state.background,
                    pillars: latest,
                    scorer,
                    coverage,
                    consecutiveUselessAnswers: nextConsecutive,
                },
            };
        }
        case "BG_INC_QUESTIONS":
            return {
                ...state,
                background: {
                    ...state.background,
                    questionsAsked: state.background.questionsAsked + 1,
                },
            };
        case "BG_MARK_TRANSITION":
            return {
                ...state,
                background: {
                    ...state.background,
                    transitioned: true,
                    transitionedAt: Date.now(),
                },
            };
        case "BG_GUARD_START_TIMER":
            return {
                ...state,
                background: {
                    ...state.background,
                    startedAtMs: state.background.startedAtMs ?? Date.now(),
                    consecutiveUselessAnswers: state.background.consecutiveUselessAnswers || 0,
                },
            };
        case "BG_GUARD_SET_REASON":
            return {
                ...state,
                background: { ...state.background, reason: action.payload.reason },
            };
        case "BG_GUARD_SET_TIMEBOX": {
            const next = action.payload.timeboxMs;
            return {
                ...state,
                background: {
                    ...state.background,
                    timeboxMs:
                        typeof next === "number" && Number.isFinite(next) && next > 0 ? next : undefined,
                },
            };
        }
        case "SET_PENDING_REPLY":
            if (action.payload.pending) {
                return {
                    ...state,
                    pendingReply: true,
                    pendingReplyContext: {
                        reason: action.payload.reason,
                        stage: action.payload.stage,
                        since: Date.now(),
                    },
                };
            }
            return {
                ...state,
                pendingReply: false,
                pendingReplyContext: undefined,
            };
        default:
            return state;
    }
}

type Listener = () => void;

function createStore(initial: InterviewChatState) {
    let currentState = initial;
    let listeners: Listener[] = [];
    return {
        getState: () => currentState,
        dispatch: (action: Action) => {
            currentState = reducer(currentState, action);
            const currentListeners = listeners.slice();
            for (const l of currentListeners) l();
        },
        subscribe: (listener: Listener) => {
            listeners.push(listener);
            return () => {
                listeners = listeners.filter((l) => l !== listener);
            };
        },
    };
}

export const interviewChatStore = createStore({
    messages: [],
    isRecording: false,
    stage: null as unknown as InterviewStage,
    pendingReply: false,
    background: {
        confidence: 0,
        questionsAsked: 0,
        transitioned: false,
    },
});
