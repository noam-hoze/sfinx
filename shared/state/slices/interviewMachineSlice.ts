import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { interviewChatStore } from "@/shared/state/interviewChatStore";
import { stopCheck } from "@/shared/services/weightedMean/scorer";
import { shouldTransition } from "@/shared/services/backgroundSessionGuard";

export type InterviewState =
    | "idle"
    | "greeting_said_by_ai"
    | "background_asked_by_ai"
    | "background_answered_by_user"
    | "in_coding_session"
    | "followup_question"
    | "ended";

export type InterviewMachineState = {
    state: InterviewState;
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
    // Page loading state for background interview
    isPageLoading?: boolean;
    // Reset trigger flag
    shouldReset?: boolean;
};

const initialState: InterviewMachineState = {
    state: "idle",
    isPageLoading: false,
    shouldReset: false,
};

const logStageTransition = (
    from: InterviewState,
    to: InterviewState,
    context?: string
) => {
    if (from === to) return;
    try {
        const suffix = context ? ` (${context})` : "";
        // eslint-disable-next-line no-console
        console.log(`[machine] ${from} -> ${to}${suffix}`);
    } catch {}
};

const interviewMachineSlice = createSlice({
    name: "interviewMachine",
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
        aiFinal: (state, action: PayloadAction<{ text: string }>) => {
            if (state.state === "idle") {
                const prev = state.state;
                state.state = "greeting_said_by_ai";
                logStageTransition(prev, state.state, "ai greeting (no guard)");
            } else if (state.state === "greeting_said_by_ai") {
                // Transition from greeting to background questions
                const prev = state.state;
                state.state = "background_asked_by_ai";
                logStageTransition(prev, state.state, "first background question");
                try {
                    const s = interviewChatStore.getState();
                    if (!s.background.startedAtMs) {
                        interviewChatStore.dispatch({ type: "BG_GUARD_START_TIMER" });
                    }
                } catch {}
            } else if (state.state === "background_answered_by_user") {
                // Evaluate guard: timebox/consecutive useless answers/stopCheck
                try {
                    const s = interviewChatStore.getState();
                    const scorer = s?.background?.scorer;
                    const coverage = s?.background?.coverage;
                    const gateReady = !!(scorer && coverage && stopCheck(scorer, coverage));
                    const consecutiveUselessAnswers = s.background.consecutiveUselessAnswers;
                    if (consecutiveUselessAnswers === undefined) {
                        throw new Error("Background guard missing consecutiveUselessAnswers");
                    }
                    const timeboxMs = s.background.timeboxMs;
                    const reason = shouldTransition(
                        {
                            startedAtMs: s.background.startedAtMs,
                            consecutiveUselessAnswers,
                            timeboxMs,
                        },
                        { gateReady, timeboxMs }
                    );
                    if (reason) {
                        interviewChatStore.dispatch({ type: "BG_GUARD_SET_REASON", payload: { reason } });
                        const prev = state.state;
                        state.state = "in_coding_session";
                        logStageTransition(prev, state.state, `guard reason: ${reason}`);
                    } else {
                        const prev = state.state;
                        state.state = "background_asked_by_ai";
                        logStageTransition(prev, state.state, "guard not satisfied");
                        // Ensure timer started on any entry to background mode
                        try {
                            const st = interviewChatStore.getState();
                            if (!st.background.startedAtMs) {
                                interviewChatStore.dispatch({ type: "BG_GUARD_START_TIMER" });
                            }
                        } catch {}
                    }
                } catch {
                    const prev = state.state;
                    state.state = "background_asked_by_ai";
                    logStageTransition(prev, state.state, "guard error path");
                }
            }
        },
        userFinal: (state) => {
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
        reset: (state) => {
            const prev = state.state;
            state.state = "idle";
            state.candidateName = undefined;
            state.expectedBackgroundQuestion = undefined;
            state.companyName = undefined;
            state.companySlug = undefined;
            state.roleSlug = undefined;
            state.isPageLoading = true;
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
        setPageLoading: (state, action: PayloadAction<{ isLoading: boolean }>) => {
            state.isPageLoading = action.payload.isLoading;
        },
    },
});

export const {
    start,
    aiFinal,
    userFinal,
    startFollowup,
    setExpectedBackgroundQuestion,
    setCompanyContext,
    setSessionId,
    end,
    reset,
    triggerReset,
    forceCoding,
    setPreloadedData,
    setPageLoading,
} = interviewMachineSlice.actions;
export default interviewMachineSlice.reducer;
