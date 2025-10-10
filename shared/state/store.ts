import { configureStore } from "@reduxjs/toolkit";
import interviewChat from "./slices/interviewChatSlice";
import interviewMachine from "./slices/interviewMachineSlice";

export const store = configureStore({
    reducer: { interviewChat, interviewMachine },
    devTools: true,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
