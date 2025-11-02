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
                const expected = `Hi ${
                    state.candidateName || "Candidate"
                }, I'm Carrie. I'll be the one interviewing today!`;
                if ((action.payload.text || "").trim() === expected) {
                    state.state = "greeting_said_by_ai";
                }
            } else if (state.state === "greeting_responded_by_user") {
                const expectedQ = (
                    state.expectedBackgroundQuestion || ""
                ).trim();
                if (
                    expectedQ &&
                    (action.payload.text || "").trim() === expectedQ
                ) {
                    state.state = "background_asked_by_ai";
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
                    const reason = shouldTransition(
                        {
                            startedAtMs: s.background.startedAtMs,
                            zeroRuns: s.background.zeroRuns || 0,
                            projectsUsed: s.background.projectsUsed || 0,
                        },
                        { gateReady }
                    );
                    if (reason) {
                        interviewChatStore.dispatch({ type: "BG_GUARD_SET_REASON", payload: { reason } });
                        state.state = "in_coding_session";
                    } else {
                        state.state = "background_asked_by_ai";
                        // Ensure timer started on any entry to background mode
                        try {
                            const st = interviewChatStore.getState();
                            if (!st.background.startedAtMs) {
                                interviewChatStore.dispatch({ type: "BG_GUARD_START_TIMER" });
                            }
                        } catch {}
                    }
                } catch {
                    state.state = "background_asked_by_ai";
                }
            }
        },
        userFinal: (state) => {
            if (state.state === "greeting_said_by_ai") {
                state.state = "greeting_responded_by_user";
            } else if (state.state === "background_asked_by_ai") {
                state.state = "background_answered_by_user";
            } else if (state.state === "followup_question") {
                // User finished after follow-up; remain in background until gate passes
                state.state = "background_answered_by_user";
            }
        },
        startFollowup: (state) => {
            state.state = "followup_question";
        },
        setExpectedBackgroundQuestion: (
            state,
            action: PayloadAction<{ question: string }>
        ) => {
            state.expectedBackgroundQuestion = action.payload.question;
        },
        end: (state) => {
            state.state = "ended";
        },
        reset: (state) => {
            state.state = "idle";
            state.candidateName = undefined;
            state.expectedBackgroundQuestion = undefined;
            state.companyName = undefined;
            state.companySlug = undefined;
            state.roleSlug = undefined;
        },
        forceCoding: (state) => {
            state.state = "in_coding_session";
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
