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
    isPasteEval?: boolean;  // Tag for paste evaluation messages
    pasteEvaluationId?: string;  // ID linking messages to specific paste conversation
};

export type InterviewStage =
    | "greeting"
    | "background"
    | "coding"
    | "submission"
    | "wrapup";


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
        transitioned: boolean;
        transitionedAt?: number;
        // Guard state
        startedAtMs?: number;
        reason?: "timebox";
        timeboxMs?: number;
    };
    // Coding stage fields
    coding: {
        activePasteEvaluation?: {
            pasteEvaluationId: string;
            pastedContent: string;
            timestamp: number;
            videoChapterId?: string;
            aiQuestionTimestamp?: number;
            confidence: number; // 0-100 (Phase 2: avg topic coverage)
            answerCount: number; // 0-7 (number of user answers)
            readyToEvaluate: boolean;
            currentQuestion?: string;
            evaluationReasoning?: string;
            evaluationCaption?: string;
            accountabilityScore?: number; // 0-100
            questionScores?: Array<{
                question: string;
                answer: string;
                score: number;
                reasoning: string;
                understandingLevel: string;
                topicsAddressed?: string[]; // Phase 2: topics covered by this answer
            }>;
            topics?: Array<{ // Phase 2: topic tracking
                name: string;
                description: string;
                percentage: number; // 0-100
                lastUpdatedBy?: number; // question number
            }>;
        };
    };
};

type Action =
    | { type: "ADD_MESSAGE"; payload: { text: string; speaker: ChatSpeaker; isPasteEval?: boolean; pasteEvaluationId?: string } }
    | { type: "CLEAR" }
    | { type: "RESET_ALL" }
    | { type: "SET_RECORDING"; payload: boolean }
    | { type: "SET_STAGE"; payload: InterviewStage }
    | { type: "BG_MARK_TRANSITION" }
    | { type: "BG_GUARD_START_TIMER" }
    | { type: "BG_GUARD_SET_REASON"; payload: { reason: "timebox" } }
    | { type: "BG_GUARD_SET_TIMEBOX"; payload: { timeboxMs?: number } }
    | { type: "BG_FORCE_TIME_EXPIRY" }
    | {
          type: "SET_PENDING_REPLY";
          payload: { pending: boolean; reason?: string; stage?: InterviewStage };
      }
    | {
          type: "CODING_START_PASTE_EVAL";
          payload: {
              pasteEvaluationId: string;
              pastedContent: string;
              timestamp: number;
              videoChapterId?: string;
              topics?: Array<{
                  name: string;
                  description: string;
                  percentage: number;
              }>;
          };
      }
    | {
          type: "CODING_UPDATE_PASTE_EVAL";
          payload: {
              confidence: number;
              answerCount: number;
              readyToEvaluate: boolean;
              currentQuestion?: string;
              videoChapterId?: string;
              aiQuestionTimestamp?: number;
              evaluationReasoning?: string;
              evaluationCaption?: string;
              accountabilityScore?: number;
              questionScores?: Array<{
                  question: string;
                  answer: string;
                  score: number;
                  reasoning: string;
                  understandingLevel: string;
                  topicsAddressed?: string[];
              }>;
              topics?: Array<{
                  name: string;
                  description: string;
                  percentage: number;
                  lastUpdatedBy?: number;
              }>;
          };
      }
    | { type: "CODING_CLEAR_PASTE_EVAL" };

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
                isPasteEval: action.payload.isPasteEval,
                pasteEvaluationId: action.payload.pasteEvaluationId,
            };
            return { ...state, messages: [...state.messages, msg] };
        }
        case "CLEAR":
            return { ...state, messages: [] };
        case "RESET_ALL":
            return {
                messages: [],
                isRecording: false,
                stage: null as unknown as InterviewStage,
                pendingReply: false,
                pendingReplyContext: undefined,
                background: {
                    confidence: 0,
                    transitioned: false,
                    transitionedAt: undefined,
                    startedAtMs: undefined,
                    reason: undefined,
                    timeboxMs: undefined,
                },
                coding: {
                    activePasteEvaluation: undefined,
                },
            };
        case "SET_RECORDING":
            return { ...state, isRecording: action.payload };
        case "SET_STAGE":
            return { ...state, stage: action.payload };
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
        case "BG_FORCE_TIME_EXPIRY": {
            const limit = state.background.timeboxMs || 7000;
            return {
                ...state,
                background: {
                    ...state.background,
                    startedAtMs: Date.now() - limit,
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
        case "CODING_START_PASTE_EVAL":
            return {
                ...state,
                coding: {
                    ...state.coding,
                    activePasteEvaluation: {
                        pasteEvaluationId: action.payload.pasteEvaluationId,
                        pastedContent: action.payload.pastedContent,
                        timestamp: action.payload.timestamp,
                        videoChapterId: action.payload.videoChapterId,
                        confidence: 0,
                        answerCount: 0, // Start at 0 - no user answers yet
                        readyToEvaluate: false,
                        accountabilityScore: 0, // Default to 0 until evaluation completes
                        questionScores: [], // Initialize empty array for per-question scores
                        topics: action.payload.topics, // Phase 2: Store topics from identification API
                    },
                },
            };
        case "CODING_UPDATE_PASTE_EVAL":
            if (!state.coding.activePasteEvaluation) return state;
            return {
                ...state,
                coding: {
                    ...state.coding,
                    activePasteEvaluation: {
                        ...state.coding.activePasteEvaluation,
                        confidence: action.payload.confidence,
                        answerCount: action.payload.answerCount,
                        readyToEvaluate: action.payload.readyToEvaluate,
                        currentQuestion: action.payload.currentQuestion,
                        videoChapterId: action.payload.videoChapterId ?? state.coding.activePasteEvaluation.videoChapterId,
                        aiQuestionTimestamp: action.payload.aiQuestionTimestamp ?? state.coding.activePasteEvaluation.aiQuestionTimestamp,
                        evaluationReasoning: action.payload.evaluationReasoning,
                        evaluationCaption: action.payload.evaluationCaption,
                        accountabilityScore: action.payload.accountabilityScore ?? state.coding.activePasteEvaluation.accountabilityScore,
                        questionScores: action.payload.questionScores ?? state.coding.activePasteEvaluation.questionScores,
                        topics: action.payload.topics ?? state.coding.activePasteEvaluation.topics,
                    },
                },
            };
        case "CODING_CLEAR_PASTE_EVAL":
            return {
                ...state,
                coding: {
                    ...state.coding,
                    activePasteEvaluation: undefined,
                },
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
        transitioned: false,
    },
    coding: {},
});
