import { configureStore } from "@reduxjs/toolkit";
import interviewChat from "./slices/interviewChatSlice";
import interviewMachine from "./slices/interviewMachineSlice";
import demo from "./slices/demoSlice";

export const store = configureStore({
    reducer: { interviewChat, interviewMachine, demo },
    devTools: true,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
