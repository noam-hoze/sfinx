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

export type InterviewChatState = {
    messages: ChatMessage[];
    isRecording: boolean;
    stage: InterviewStage;
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
    | { type: "BG_MARK_TRANSITION" };

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
            const prev = state.background.aggPillars || {
                adaptability: 0,
                creativity: 0,
                reasoning: 0,
            };
            const n = state.background.samples || 0;
            const next = {
                adaptability: (prev.adaptability * n + action.payload.pillars.adaptability) / (n + 1),
                creativity: (prev.creativity * n + action.payload.pillars.creativity) / (n + 1),
                reasoning: (prev.reasoning * n + action.payload.pillars.reasoning) / (n + 1),
            };
            const aggConfidence = (next.adaptability + next.creativity + next.reasoning) / 3;
            return {
                ...state,
                background: {
                    ...state.background,
                    aggPillars: next,
                    aggConfidence,
                    samples: n + 1,
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
    stage: "greeting",
    background: {
        confidence: 0,
        questionsAsked: 0,
        transitioned: false,
    },
});
