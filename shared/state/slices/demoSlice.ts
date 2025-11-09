/**
 * Redux slice for demo flow state management.
 * Tracks current interview session and demo mode status.
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface DemoState {
    interviewId: string | null;
    demoMode: boolean;
    currentStage: 1 | 2 | 3 | 4 | 5;
}

const initialState: DemoState = {
    interviewId: null,
    demoMode: false,
    currentStage: 1,
};

const demoSlice = createSlice({
    name: "demo",
    initialState,
    reducers: {
        setInterviewId(state, action: PayloadAction<string>) {
            state.interviewId = action.payload;
        },
        setDemoMode(state, action: PayloadAction<boolean>) {
            state.demoMode = action.payload;
        },
        setCurrentStage(state, action: PayloadAction<1 | 2 | 3 | 4 | 5>) {
            state.currentStage = action.payload;
        },
        resetDemo(state) {
            state.interviewId = null;
            state.demoMode = false;
            state.currentStage = 1;
        },
    },
});

export const { setInterviewId, setDemoMode, setCurrentStage, resetDemo } =
    demoSlice.actions;
export default demoSlice.reducer;

