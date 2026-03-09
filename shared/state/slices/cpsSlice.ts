import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ActiveEvidenceSelection {
    globalIndex: number;
    categoryKey: string | null;
    localIndex: number | null;
    timestamp: number;
    source: "overlay" | "row" | "external" | null;
}

interface CpsState {
    activeEvidenceTimestamp: number | null;
    activeEvidenceKey: string | null; // Unique key: `${label}-${timestamp}-${index}`
    activeCaption: string | null;
    activeEvidenceSelection: ActiveEvidenceSelection | null;
}

const initialState: CpsState = {
    activeEvidenceTimestamp: null,
    activeEvidenceKey: null,
    activeCaption: null,
    activeEvidenceSelection: null,
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
        setActiveEvidenceSelection: (state, action: PayloadAction<ActiveEvidenceSelection | null>) => {
            state.activeEvidenceSelection = action.payload;
            state.activeEvidenceTimestamp = action.payload?.timestamp ?? null;
            state.activeEvidenceKey = action.payload
                ? `${action.payload.categoryKey ?? "evidence"}-${action.payload.timestamp}-${action.payload.localIndex ?? action.payload.globalIndex}`
                : null;
        },
        setActiveCaption: (state, action: PayloadAction<string | null>) => {
            state.activeCaption = action.payload;
        },
    },
});

export const {
    setActiveEvidenceTimestamp,
    setActiveEvidenceKey,
    setActiveEvidenceSelection,
    setActiveCaption,
} = cpsSlice.actions;
export default cpsSlice.reducer;
