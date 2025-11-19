import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface CpsState {
    activeEvidenceTimestamp: number | null;
}

const initialState: CpsState = {
    activeEvidenceTimestamp: null,
};

const cpsSlice = createSlice({
    name: "cps",
    initialState,
    reducers: {
        setActiveEvidenceTimestamp: (state, action: PayloadAction<number | null>) => {
            state.activeEvidenceTimestamp = action.payload;
        },
    },
});

export const { setActiveEvidenceTimestamp } = cpsSlice.actions;
export default cpsSlice.reducer;

