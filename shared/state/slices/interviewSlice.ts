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
    // Company/job context for dynamic prompts, script selection, and redirects
    companyName?: string;
    companyId?: string;
    jobId?: string;
    jobTitle?: string;
    companySlug?: string;
    roleSlug?: string;
    // Interview session ID for persisting conversation data
    sessionId?: string;
    // Preloaded data for instant interview start
    userId?: string;
    applicationId?: string;
    script?: any;
    preloadedFirstQuestion?: string;
    preloadedFirstIntent?: string;
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
                companyId?: string;
                jobId?: string;
                jobTitle?: string;
                companySlug?: string;
                roleSlug?: string;
            }>
        ) => {
            state.companyName = action.payload.companyName;
            state.companyId = action.payload.companyId;
            state.jobId = action.payload.jobId;
            state.jobTitle = action.payload.jobTitle;
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
            state.companyId = undefined;
            state.jobId = undefined;
            state.jobTitle = undefined;
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
                preloadedFirstIntent?: string;
            }>
        ) => {
            if (action.payload.userId) state.userId = action.payload.userId;
            if (action.payload.applicationId) state.applicationId = action.payload.applicationId;
            if (action.payload.script) state.script = action.payload.script;
            if (action.payload.preloadedFirstQuestion) state.preloadedFirstQuestion = action.payload.preloadedFirstQuestion;
            if (action.payload.preloadedFirstIntent) state.preloadedFirstIntent = action.payload.preloadedFirstIntent;
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
