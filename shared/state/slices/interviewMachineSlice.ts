import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type InterviewState =
    | "idle"
    | "greeting_said_by_ai"
    | "greeting_responded_by_user"
    | "background_asked_by_ai"
    | "background_answered_by_user"
    | "coding_challenge_presented_by_ai"
    | "ended";

export type InterviewMachineState = {
    state: InterviewState;
    candidateName?: string;
    expectedBackgroundQuestion?: string;
    // True once the coding challenge AI text is received (coding session active)
    is_in_coding_session: boolean;
    // Company/role context for dynamic prompts and script selection
    companyName?: string;
    companySlug?: string;
    roleSlug?: string;
};

const initialState: InterviewMachineState = {
    state: "idle",
    is_in_coding_session: false,
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
                }
            } else if (state.state === "background_answered_by_user") {
                // After we instruct the AI to present the coding challenge, mark it when AI responds
                state.state = "coding_challenge_presented_by_ai";
                state.is_in_coding_session = true;
            }
        },
        userFinal: (state) => {
            if (state.state === "greeting_said_by_ai") {
                state.state = "greeting_responded_by_user";
            } else if (state.state === "background_asked_by_ai") {
                state.state = "background_answered_by_user";
            }
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
            state.is_in_coding_session = false;
            state.companyName = undefined;
            state.companySlug = undefined;
            state.roleSlug = undefined;
        },
    },
});

export const {
    start,
    aiFinal,
    userFinal,
    setExpectedBackgroundQuestion,
    setCompanyContext,
    end,
    reset,
} = interviewMachineSlice.actions;
export default interviewMachineSlice.reducer;
