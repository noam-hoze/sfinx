import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface CpsState {
    activeEvidenceTimestamp: number | null;
    activeEvidenceKey: string | null; // Unique key: `${label}-${timestamp}-${index}`
    activeCaption: string | null;
}

const initialState: CpsState = {
    activeEvidenceTimestamp: null,
    activeEvidenceKey: null,
    activeCaption: null,
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
        },
        setActiveCaption: (state, action: PayloadAction<string | null>) => {
            state.activeCaption = action.payload;
        },
    },
});

export const { setActiveEvidenceTimestamp, setActiveEvidenceKey, setActiveCaption } = cpsSlice.actions;
export default cpsSlice.reducer;
