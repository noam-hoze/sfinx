import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type InterviewState =
    | "idle"
    | "greeting_said_by_ai"
    | "greeting_responded_by_user"
    | "ended";

export type InterviewMachineState = {
    state: InterviewState;
    candidateName?: string;
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
            }
        },
        userFinal: (state) => {
            if (state.state === "greeting_said_by_ai") {
                state.state = "greeting_responded_by_user";
            }
        },
        end: (state) => {
            state.state = "ended";
        },
        reset: (state) => {
            state.state = "idle";
            state.candidateName = undefined;
        },
    },
});

export const { start, aiFinal, userFinal, end, reset } =
    interviewMachineSlice.actions;
export default interviewMachineSlice.reducer;
