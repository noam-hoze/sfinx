import { createSlice, PayloadAction, createAction } from "@reduxjs/toolkit";

/**
 * Global reset action that all interview-related slices listen to.
 * Provides coordinated cleanup when leaving the interview flow.
 */
export const resetInterview = createAction("interview/RESET_ALL");

export type InterviewMachineState =
    | "idle"
    | "greeting_said_by_ai"
    | "background_asked_by_ai"
    | "background_answered_by_user"
    | "in_coding_session"
    | "followup_question"
    | "ended";

export type InterviewStage =
    | "greeting"
    | "background"
    | "coding"
    | "submission"
    | "wrapup";

export type InterviewState = {
    state: InterviewMachineState;
    isRecording: boolean;
    stage: InterviewStage | null;
    candidateName?: string;
    expectedBackgroundQuestion?: string;
    // Company/role context for dynamic prompts and script selection
    companyName?: string;
    companySlug?: string;
    roleSlug?: string;
    // Interview session ID for persisting conversation data
    sessionId?: string;
    // Preloaded data for instant interview start
    userId?: string;
    applicationId?: string;
    script?: any;
    preloadedFirstQuestion?: string;
    // Reset trigger flag
    shouldReset?: boolean;
};

const initialState: InterviewState = {
    state: "idle",
    isRecording: false,
    stage: null,
    shouldReset: false,
};

const logStageTransition = (
    from: InterviewMachineState,
    to: InterviewMachineState,
    context?: string
) => {
    if (from === to) return;
    try {
        const suffix = context ? ` (${context})` : "";
        // eslint-disable-next-line no-console
        console.log(`[machine] ${from} -> ${to}${suffix}`);
    } catch {}
};

const interviewSlice = createSlice({
    name: "interview",
    initialState,
    reducers: {
        start: (state, action: PayloadAction<{ candidateName: string }>) => {
            state.candidateName = action.payload.candidateName;
        },
        setCompanyContext: (
            state,
            action: PayloadAction<{
                companyName?: string;
                companySlug?: string;
                roleSlug?: string;
            }>
        ) => {
            state.companyName = action.payload.companyName;
            state.companySlug = action.payload.companySlug;
            state.roleSlug = action.payload.roleSlug;
        },
        setSessionId: (state, action: PayloadAction<{ sessionId: string }>) => {
            state.sessionId = action.payload.sessionId;
        },
        interviewerMessage: (state, action: PayloadAction<{ text: string }>) => {
            if (state.state === "idle") {
                const prev = state.state;
                state.state = "greeting_said_by_ai";
                logStageTransition(prev, state.state, "ai greeting (no guard)");
            } else if (state.state === "greeting_said_by_ai") {
                // Transition from greeting to background questions
                const prev = state.state;
                state.state = "background_asked_by_ai";
                logStageTransition(prev, state.state, "first background question");
            } else if (state.state === "background_answered_by_user") {
                // Gate check now handled in useBackgroundAnswerHandler
                // This reducer just transitions to next question
                const prev = state.state;
                state.state = "background_asked_by_ai";
                logStageTransition(prev, state.state, "guard not satisfied");
            }
        },
        candidateMessage: (state) => {
            if (state.state === "background_asked_by_ai") {
                const prev = state.state;
                state.state = "background_answered_by_user";
                logStageTransition(prev, state.state, "user answered background question");
            } else if (state.state === "followup_question") {
                // User finished after follow-up; remain in background until gate passes
                const prev = state.state;
                state.state = "background_answered_by_user";
                logStageTransition(prev, state.state, "follow-up answered");
            }
        },
        startFollowup: (state) => {
            const prev = state.state;
            state.state = "followup_question";
            logStageTransition(prev, state.state, "follow-up initiated");
        },
        setExpectedBackgroundQuestion: (
            state,
            action: PayloadAction<{ question: string }>
        ) => {
            state.expectedBackgroundQuestion = action.payload.question;
        },
        end: (state) => {
            const prev = state.state;
            state.state = "ended";
            logStageTransition(prev, state.state, "interview ended");
        },
        setRecording: (state, action: PayloadAction<{ isRecording: boolean }>) => {
            state.isRecording = action.payload.isRecording;
        },
        setStage: (state, action: PayloadAction<{ stage: InterviewStage }>) => {
            state.stage = action.payload.stage;
        },
        reset: (state) => {
            const prev = state.state;
            state.state = "idle";
            state.isRecording = false;
            state.stage = null;
            state.candidateName = undefined;
            state.expectedBackgroundQuestion = undefined;
            state.companyName = undefined;
            state.companySlug = undefined;
            state.roleSlug = undefined;
            state.shouldReset = false; // Clear the flag after reset
            logStageTransition(prev, state.state, "reset");
        },
        triggerReset: (state) => {
            state.shouldReset = true;
        },
        forceCoding: (state) => {
            const prev = state.state;
            state.state = "in_coding_session";
            logStageTransition(prev, state.state, "forced");
        },
        setPreloadedData: (
            state,
            action: PayloadAction<{
                userId?: string;
                applicationId?: string;
                script?: any;
                preloadedFirstQuestion?: string;
            }>
        ) => {
            if (action.payload.userId) state.userId = action.payload.userId;
            if (action.payload.applicationId) state.applicationId = action.payload.applicationId;
            if (action.payload.script) state.script = action.payload.script;
            if (action.payload.preloadedFirstQuestion) state.preloadedFirstQuestion = action.payload.preloadedFirstQuestion;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(resetInterview, () => initialState);
    },
});

export const {
    start,
    interviewerMessage,
    candidateMessage,
    startFollowup,
    setExpectedBackgroundQuestion,
    setCompanyContext,
    setSessionId,
    setRecording,
    setStage,
    end,
    reset,
    triggerReset,
    forceCoding,
    setPreloadedData,
} = interviewSlice.actions;
export default interviewSlice.reducer;
