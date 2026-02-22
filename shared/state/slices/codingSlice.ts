import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { resetInterview } from "./interviewSlice";

export type ChatSpeaker = "user" | "ai";

export type ChatMessage = {
    id: string;
    text: string;
    speaker: ChatSpeaker;
    timestamp: number;
    isPasteEval?: boolean;
    pasteEvaluationId?: string;
};

export type CodingState = {
    messages: ChatMessage[];
    pendingReply: boolean;
    timeboxSeconds?: number;
    activePasteEvaluation?: {
        pasteEvaluationId: string;
        pastedContent: string;
        timestamp: number;
        pasteAccountabilityScore: number;
        answerCount: number;
        readyToEvaluate: boolean;
        currentQuestion?: string;
        evaluationReasoning?: string;
        evaluationCaption?: string;
        accountabilityScore?: number;
        questionScores?: Array<{
            question: string;
            answer: string;
            score: number;
            reasoning: string;
            understandingLevel: string;
            topicsAddressed?: string[];
        }>;
        topics?: Array<{
            name: string;
            description: string;
            percentage: number;
            lastUpdatedBy?: number;
        }>;
    };
};

const initialState: CodingState = {
    messages: [],
    pendingReply: false,
};

const codingSlice = createSlice({
    name: "coding",
    initialState,
    reducers: {
        addMessage: (
            state,
            action: PayloadAction<{
                text: string;
                speaker: ChatSpeaker;
                isPasteEval?: boolean;
                pasteEvaluationId?: string;
            }>
        ) => {
            const msg: ChatMessage = {
                id: crypto.randomUUID(),
                text: action.payload.text,
                speaker: action.payload.speaker,
                timestamp: Date.now(),
                isPasteEval: action.payload.isPasteEval,
                pasteEvaluationId: action.payload.pasteEvaluationId,
            };
            state.messages.push(msg);
        },
        clear: (state) => {
            state.messages = [];
        },
        setPendingReply: (
            state,
            action: PayloadAction<{ pending: boolean }>
        ) => {
            state.pendingReply = action.payload.pending;
        },
        setTimebox: (
            state,
            action: PayloadAction<{ timeboxSeconds: number }>
        ) => {
            state.timeboxSeconds = action.payload.timeboxSeconds;
        },
        startPasteEvaluation: (
            state,
            action: PayloadAction<{
                pasteEvaluationId: string;
                pastedContent: string;
                timestamp: number;
                topics?: Array<{
                    name: string;
                    description: string;
                    percentage: number;
                }>;
            }>
        ) => {
            state.activePasteEvaluation = {
                pasteEvaluationId: action.payload.pasteEvaluationId,
                pastedContent: action.payload.pastedContent,
                timestamp: action.payload.timestamp,
                pasteAccountabilityScore: 0,
                answerCount: 0,
                readyToEvaluate: false,
                accountabilityScore: 0,
                questionScores: [],
                topics: action.payload.topics,
            };
        },
        incrementPasteAnswer: (state) => {
            if (!state.activePasteEvaluation) return;
            state.activePasteEvaluation.answerCount += 1;
        },
        setPasteQuestion: (state, action: PayloadAction<string>) => {
            if (!state.activePasteEvaluation) return;
            state.activePasteEvaluation.currentQuestion = action.payload;
        },
        setPasteScore: (state, action: PayloadAction<number>) => {
            if (!state.activePasteEvaluation) return;
            state.activePasteEvaluation.pasteAccountabilityScore = action.payload;
        },
        setPasteReadyToEvaluate: (state, action: PayloadAction<boolean>) => {
            if (!state.activePasteEvaluation) return;
            state.activePasteEvaluation.readyToEvaluate = action.payload;
        },
        updatePasteTopics: (
            state,
            action: PayloadAction<Array<{
                name: string;
                description: string;
                percentage: number;
                lastUpdatedBy?: number;
            }>>
        ) => {
            if (!state.activePasteEvaluation) return;
            state.activePasteEvaluation.topics = action.payload;
        },
        updatePasteQuestionScores: (
            state,
            action: PayloadAction<Array<{
                question: string;
                answer: string;
                score: number;
                reasoning: string;
                understandingLevel: string;
                topicsAddressed?: string[];
            }>>
        ) => {
            if (!state.activePasteEvaluation) return;
            state.activePasteEvaluation.questionScores = action.payload;
        },
        setPasteEvaluationSummary: (
            state,
            action: PayloadAction<{
                reasoning: string;
                caption: string;
                finalScore: number;
            }>
        ) => {
            if (!state.activePasteEvaluation) return;
            state.activePasteEvaluation.evaluationReasoning = action.payload.reasoning;
            state.activePasteEvaluation.evaluationCaption = action.payload.caption;
            state.activePasteEvaluation.accountabilityScore = action.payload.finalScore;
        },
        clearPasteEvaluation: (state) => {
            state.activePasteEvaluation = undefined;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(resetInterview, () => initialState);
    },
});

export const {
    addMessage,
    clear,
    setPendingReply,
    setTimebox,
    startPasteEvaluation,
    incrementPasteAnswer,
    setPasteQuestion,
    setPasteScore,
    setPasteReadyToEvaluate,
    updatePasteTopics,
    updatePasteQuestionScores,
    setPasteEvaluationSummary,
    clearPasteEvaluation,
} = codingSlice.actions;

export default codingSlice.reducer;
