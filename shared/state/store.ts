import { configureStore } from "@reduxjs/toolkit";
import background from "./slices/backgroundSlice";
import coding from "./slices/codingSlice";
import interview from "./slices/interviewSlice";
import cps from "./slices/cpsSlice";

export const store = configureStore({
    reducer: { background, coding, interview, cps },
    devTools: true,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
