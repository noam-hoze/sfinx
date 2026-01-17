import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { resetInterview } from "./interviewSlice";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

export type ChatSpeaker = "user" | "ai";

export type ChatMessage = {
    id: string;
    text: string;
    speaker: ChatSpeaker;
    timestamp: number;
};

export type CategoryStats = {
    categoryName: string;
    count: number;
    avgStrength: number;
    dontKnowCount: number;
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
    categoryStats: CategoryStats[];
};

const LOG_CATEGORY = LOG_CATEGORIES.BACKGROUND_INTERVIEW;
/**
 * Check if strict validation is enabled.
 */
function isStrictValidation(): boolean {
    return process.env.NEXT_PUBLIC_STRICT_VALIDATION === "true";
}

/**
 * Require a finite timebox in milliseconds.
 */
function requireTimeboxMs(timeboxMs?: number): number {
    if (typeof timeboxMs !== "number" || !Number.isFinite(timeboxMs) || timeboxMs <= 0) {
        log.error(LOG_CATEGORY, "[backgroundSlice] Missing or invalid timeboxMs", { timeboxMs });
        throw new Error("timeboxMs is required.");
    }
    return timeboxMs;
}

const initialState: BackgroundState = {
    messages: [],
    transitioned: false,
    evaluatingAnswer: false,
    currentFocusTopic: null,
    currentQuestionTarget: null,
    categoryStats: [],
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
            const limit = requireTimeboxMs(state.timeboxMs);
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
        initializeCategoryStats: (state, action: PayloadAction<{ categories: string[] }>) => {
            state.categoryStats = action.payload.categories.map(name => ({
                categoryName: name,
                count: 0,
                avgStrength: 0,
                dontKnowCount: 0,
            }));
        },
        updateCategoryStats: (state, action: PayloadAction<{ stats: CategoryStats[] }>) => {
            state.categoryStats = action.payload.stats.map(newCat => {
                const existing = state.categoryStats.find(c => c.categoryName === newCat.categoryName);
                if (!existing) {
                    log.warn(LOG_CATEGORY, "[backgroundSlice] Missing existing category stats", {
                        categoryName: newCat.categoryName,
                    });
                    if (isStrictValidation()) {
                        throw new Error(`Missing category stats for ${newCat.categoryName}`);
                    }
                    return newCat;
                }
                return {
                    ...newCat,
                    dontKnowCount: existing.dontKnowCount,
                };
            });
        },
        incrementDontKnowCount: (
            state,
            action: PayloadAction<{ category: string }>
        ) => {
            const cat = state.categoryStats.find(
                c => c.categoryName === action.payload.category
            );
            if (cat) {
                cat.dontKnowCount += 1;
            }
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
    initializeCategoryStats,
    updateCategoryStats,
    incrementDontKnowCount,
} = backgroundSlice.actions;

export default backgroundSlice.reducer;
