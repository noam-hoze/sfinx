import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { resetInterview } from "./interviewSlice";

export type ChatSpeaker = "user" | "ai";

export type ChatMessage = {
    id: string;
    text: string;
    speaker: ChatSpeaker;
    timestamp: number;
};

export type BackgroundState = {
    messages: ChatMessage[];
    startedAtMs?: number;
    timeboxMs?: number;
    transitioned: boolean;
    transitionedAt?: number;
    reason?: "timebox";
    evaluatingAnswer: boolean;
    currentFocusTopic: string | null;
    currentQuestionTarget: { question: string; category: string } | null;
};

const initialState: BackgroundState = {
    messages: [],
    transitioned: false,
    evaluatingAnswer: false,
    currentFocusTopic: null,
    currentQuestionTarget: null,
};

const backgroundSlice = createSlice({
    name: "background",
    initialState,
    reducers: {
        addMessage: (
            state,
            action: PayloadAction<{ text: string; speaker: ChatSpeaker }>
        ) => {
            const msg: ChatMessage = {
                id:
                    typeof crypto !== "undefined" && (crypto as any).randomUUID
                        ? (crypto as any).randomUUID()
                        : `${Date.now()}-${Math.random()}`,
                text: action.payload.text,
                speaker: action.payload.speaker,
                timestamp: Date.now(),
            };
            state.messages.push(msg);
        },
        clear: (state) => {
            state.messages = [];
        },
        resetAll: () => {
            return initialState;
        },
        startTimer: (state) => {
            if (!state.startedAtMs) {
                state.startedAtMs = Date.now();
            }
        },
        setTimebox: (state, action: PayloadAction<{ timeboxMs?: number }>) => {
            const next = action.payload.timeboxMs;
            state.timeboxMs =
                typeof next === "number" && Number.isFinite(next) && next > 0
                    ? next
                    : undefined;
        },
        forceTimeExpiry: (state) => {
            const limit = state.timeboxMs || 7000;
            state.startedAtMs = Date.now() - limit;
        },
        markTransition: (state) => {
            state.transitioned = true;
            state.transitionedAt = Date.now();
        },
        setReason: (state, action: PayloadAction<{ reason: "timebox" }>) => {
            state.reason = action.payload.reason;
        },
        setEvaluatingAnswer: (state, action: PayloadAction<{ evaluating: boolean }>) => {
            state.evaluatingAnswer = action.payload.evaluating;
        },
        setCurrentFocusTopic: (state, action: PayloadAction<{ topicName: string | null }>) => {
            state.currentFocusTopic = action.payload.topicName;
        },
        setCurrentQuestionTarget: (state, action: PayloadAction<{ question: string; category: string } | null>) => {
            state.currentQuestionTarget = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(resetInterview, () => initialState);
    },
});

export const {
    addMessage,
    clear,
    resetAll,
    startTimer,
    setTimebox,
    forceTimeExpiry,
    markTransition,
    setReason,
    setEvaluatingAnswer,
    setCurrentFocusTopic,
    setCurrentQuestionTarget,
} = backgroundSlice.actions;

export default backgroundSlice.reducer;
