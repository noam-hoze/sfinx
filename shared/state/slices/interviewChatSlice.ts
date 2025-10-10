import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ChatSpeaker = "user" | "ai";

export type ChatMessage = {
    id: string;
    text: string;
    speaker: ChatSpeaker;
    timestamp: number;
};

export type InterviewChatState = {
    messages: ChatMessage[];
    isRecording: boolean;
};

const initialState: InterviewChatState = {
    messages: [],
    isRecording: false,
};

const interviewChatSlice = createSlice({
    name: "interviewChat",
    initialState,
    reducers: {
        addMessage: (
            state,
            action: PayloadAction<{ text: string; speaker: ChatSpeaker }>
        ) => {
            const msg: ChatMessage = {
                id:
                    typeof crypto !== "undefined" && (crypto as any).randomUUID
                        ? (crypto as any).randomUUID()
                        : `${Date.now()}-${Math.random()}`,
                text: action.payload.text,
                speaker: action.payload.speaker,
                timestamp: Date.now(),
            };
            state.messages.push(msg);
        },
        clear: (state) => {
            state.messages = [];
        },
        setRecording: (state, action: PayloadAction<boolean>) => {
            state.isRecording = action.payload;
        },
    },
});

export const { addMessage, clear, setRecording } = interviewChatSlice.actions;
export default interviewChatSlice.reducer;
