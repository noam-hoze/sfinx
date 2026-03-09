import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { resetInterview } from "./interviewSlice";

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

/**
 * A substantive probe question recorded for full-session deduplication.
 * Stores both raw text and a structured fingerprint for semantic matching.
 */
export type SubstantiveProbe = {
    question: string;   // Full rendered question text
    topic: string;      // Focus topic at the time of the question
    angle: string;      // ProbeAngle value
    slot: string;       // Constrained slot label from allowed vocabulary
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
    currentQuestionSequence: number;
    clarificationRetryCount: number;
    /** Tracks which probe angles have been used per topic to prevent semantic repetition. */
    coveredAnglesPerTopic: Record<string, string[]>;
    /** Full history of substantive probe questions for global deduplication. */
    substantiveProbeHistory: SubstantiveProbe[];
};

const initialState: BackgroundState = {
    messages: [],
    transitioned: false,
    evaluatingAnswer: false,
    currentFocusTopic: null,
    currentQuestionTarget: null,
    categoryStats: [],
    currentQuestionSequence: 0,
    clarificationRetryCount: 0,
    coveredAnglesPerTopic: {},
    substantiveProbeHistory: [],
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
        initializeCategoryStats: (state, action: PayloadAction<{ categories: string[] }>) => {
            state.categoryStats = action.payload.categories.map(name => ({
                categoryName: name,
                count: 0,
                avgStrength: 0,
                dontKnowCount: 0,
            }));
        },
        updateCategoryStats: (state, action: PayloadAction<{ stats: CategoryStats[] }>) => {
            // API now returns dontKnowCount, so just use it directly
            state.categoryStats = action.payload.stats;
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
        incrementQuestionSequence: (state) => {
            state.currentQuestionSequence += 1;
            state.clarificationRetryCount = 0; // Reset retry count for new question
        },
        incrementClarificationRetry: (state) => {
            state.clarificationRetryCount += 1;
        },
        resetClarificationRetry: (state) => {
            state.clarificationRetryCount = 0;
        },
        /** Record a substantive probe question for full-session deduplication. */
        addSubstantiveProbe: (state, action: PayloadAction<SubstantiveProbe>) => {
            state.substantiveProbeHistory.push(action.payload);
        },
        /** Record that a probe angle has been used for a given topic, preventing semantic repetition. */
        addCoveredAngle: (state, action: PayloadAction<{ topic: string; angle: string }>) => {
            const { topic, angle } = action.payload;
            if (!state.coveredAnglesPerTopic[topic]) {
                state.coveredAnglesPerTopic[topic] = [];
            }
            if (!state.coveredAnglesPerTopic[topic].includes(angle)) {
                state.coveredAnglesPerTopic[topic].push(angle);
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
    incrementQuestionSequence,
    incrementClarificationRetry,
    resetClarificationRetry,
    addCoveredAngle,
    addSubstantiveProbe,
} = backgroundSlice.actions;

export default backgroundSlice.reducer;
