import { createSlice, PayloadAction, createAction } from "@reduxjs/toolkit";

/**
 * Global reset action that all interview-related slices listen to.
 * Provides coordinated cleanup when leaving the interview flow.
 */
export const resetInterview = createAction("interview/RESET_ALL");

export type InterviewStage =
    | "greeting"
    | "background"
    | "coding"
    | "submission"
    | "wrapup";

export type InterviewState = {
    isRecording: boolean;
    stage: InterviewStage | null;
    candidateName?: string;
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
    isRecording: false,
    stage: null,
    shouldReset: false,
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
        end: (state) => {
            state.stage = "wrapup";
        },
        setRecording: (state, action: PayloadAction<{ isRecording: boolean }>) => {
            state.isRecording = action.payload.isRecording;
        },
        setStage: (state, action: PayloadAction<{ stage: InterviewStage }>) => {
            state.stage = action.payload.stage;
        },
        reset: (state) => {
            state.isRecording = false;
            state.stage = null;
            state.candidateName = undefined;
            state.companyName = undefined;
            state.companySlug = undefined;
            state.roleSlug = undefined;
            state.shouldReset = false;
        },
        triggerReset: (state) => {
            state.shouldReset = true;
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
    setCompanyContext,
    setSessionId,
    setRecording,
    setStage,
    end,
    reset,
    triggerReset,
    setPreloadedData,
} = interviewSlice.actions;
export default interviewSlice.reducer;
