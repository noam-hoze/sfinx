import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface CpsState {
    activeEvidenceTimestamp: number | null;
    activeEvidenceKey: string | null; // Unique key: `${timestamp}-${evaluation}`
}

const initialState: CpsState = {
    activeEvidenceTimestamp: null,
    activeEvidenceKey: null,
};

const cpsSlice = createSlice({
    name: "cps",
    initialState,
    reducers: {
        setActiveEvidenceTimestamp: (state, action: PayloadAction<number | null>) => {
            state.activeEvidenceTimestamp = action.payload;
        },
        setActiveEvidenceKey: (state, action: PayloadAction<string | null>) => {
            state.activeEvidenceKey = action.payload;
            // Also set timestamp for backward compatibility
            if (action.payload) {
                const timestamp = parseInt(action.payload.split('-')[0]);
                state.activeEvidenceTimestamp = timestamp;
            } else {
                state.activeEvidenceTimestamp = null;
            }
        },
    },
});

export const { setActiveEvidenceTimestamp, setActiveEvidenceKey } = cpsSlice.actions;
export default cpsSlice.reducer;
