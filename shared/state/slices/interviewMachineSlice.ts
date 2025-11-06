import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { interviewChatStore } from "@/shared/state/interviewChatStore";
import { stopCheck } from "@/shared/services/weightedMean/scorer";
import { shouldTransition } from "@/shared/services/backgroundSessionGuard";

export type InterviewState =
    | "idle"
    | "greeting_said_by_ai"
    | "greeting_responded_by_user"
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
};

const initialState: InterviewMachineState = {
    state: "idle",
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
        aiFinal: (state, action: PayloadAction<{ text: string }>) => {
            if (state.state === "idle") {
                if (!state.candidateName) {
                    throw new Error("Interview machine missing candidateName");
                }
                const expected = `Hi ${
                    state.candidateName
                }, I'm Carrie. I'll be the one interviewing today!`;
                const incomingText = action.payload.text;
                if (!incomingText) {
                    return;
                }
                if (incomingText.trim() === expected) {
                    const prev = state.state;
                    state.state = "greeting_said_by_ai";
                    logStageTransition(prev, state.state, "ai greeting matched");
                }
            } else if (state.state === "greeting_responded_by_user") {
                const expectedQ = state.expectedBackgroundQuestion?.trim();
                if (
                    expectedQ &&
                    action.payload.text &&
                    action.payload.text.trim() === expectedQ
                ) {
                    const prev = state.state;
                    state.state = "background_asked_by_ai";
                    logStageTransition(prev, state.state, "expected background question matched");
                    try {
                        const s = interviewChatStore.getState();
                        if (!s.background.startedAtMs) {
                            interviewChatStore.dispatch({ type: "BG_GUARD_START_TIMER" });
                        }
                    } catch {}
                }
            } else if (state.state === "background_answered_by_user") {
                // Evaluate guard: timebox/projects cap/stopCheck
                try {
                    const s = interviewChatStore.getState();
                    const scorer = s?.background?.scorer;
                    const coverage = s?.background?.coverage;
                    const gateReady = !!(scorer && coverage && stopCheck(scorer, coverage));
                    const zeroRuns = s.background.zeroRuns;
                    if (zeroRuns === undefined) {
                        throw new Error("Background guard missing zeroRuns");
                    }
                    const projectsUsed = s.background.projectsUsed;
                    if (projectsUsed === undefined) {
                        throw new Error("Background guard missing projectsUsed");
                    }
                    const reason = shouldTransition(
                        {
                            startedAtMs: s.background.startedAtMs,
                            zeroRuns,
                            projectsUsed,
                        },
                        { gateReady }
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
            if (state.state === "greeting_said_by_ai") {
                const prev = state.state;
                state.state = "greeting_responded_by_user";
                logStageTransition(prev, state.state, "user replied");
            } else if (state.state === "background_asked_by_ai") {
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
            logStageTransition(prev, state.state, "reset");
        },
        forceCoding: (state) => {
            const prev = state.state;
            state.state = "in_coding_session";
            logStageTransition(prev, state.state, "forced");
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
    end,
    reset,
    forceCoding,
} = interviewMachineSlice.actions;
export default interviewMachineSlice.reducer;
