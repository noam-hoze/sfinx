import { configureStore } from "@reduxjs/toolkit";
import interviewChat from "./slices/interviewChatSlice";
import interviewMachine from "./slices/interviewMachineSlice";
import demo from "./slices/demoSlice";
import cps from "./slices/cpsSlice";

export const store = configureStore({
    reducer: { interviewChat, interviewMachine, demo, cps },
    devTools: true,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
