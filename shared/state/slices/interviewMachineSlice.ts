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
        },
    },
});

export const {
    start,
    aiFinal,
    userFinal,
    setExpectedBackgroundQuestion,
    end,
    reset,
} = interviewMachineSlice.actions;
export default interviewMachineSlice.reducer;
