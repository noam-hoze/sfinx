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

type PendingReplyContext = {
    reason?: string;
    since: number;
};

export type CodingState = {
    messages: ChatMessage[];
    pendingReply: boolean;
    pendingReplyContext?: PendingReplyContext;
    timeboxSeconds?: number;
    activePasteEvaluation?: {
        pasteEvaluationId: string;
        pastedContent: string;
        timestamp: number;
        videoChapterId?: string;
        aiQuestionTimestamp?: number;
        confidence: number;
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
                id:
                    typeof crypto !== "undefined" && (crypto as any).randomUUID
                        ? (crypto as any).randomUUID()
                        : `${Date.now()}-${Math.random()}`,
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
        resetAll: () => {
            return initialState;
        },
        setPendingReply: (
            state,
            action: PayloadAction<{ pending: boolean; reason?: string }>
        ) => {
            if (action.payload.pending) {
                state.pendingReply = true;
                state.pendingReplyContext = {
                    reason: action.payload.reason,
                    since: Date.now(),
                };
            } else {
                state.pendingReply = false;
                state.pendingReplyContext = undefined;
            }
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
                videoChapterId?: string;
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
                videoChapterId: action.payload.videoChapterId,
                confidence: 0,
                answerCount: 0,
                readyToEvaluate: false,
                accountabilityScore: 0,
                questionScores: [],
                topics: action.payload.topics,
            };
        },
        updatePasteEvaluation: (
            state,
            action: PayloadAction<{
                confidence: number;
                answerCount: number;
                readyToEvaluate: boolean;
                currentQuestion?: string;
                videoChapterId?: string;
                aiQuestionTimestamp?: number;
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
            }>
        ) => {
            if (!state.activePasteEvaluation) return;

            state.activePasteEvaluation.confidence = action.payload.confidence;
            state.activePasteEvaluation.answerCount = action.payload.answerCount;
            state.activePasteEvaluation.readyToEvaluate = action.payload.readyToEvaluate;

            if (action.payload.currentQuestion !== undefined) {
                state.activePasteEvaluation.currentQuestion = action.payload.currentQuestion;
            }
            if (action.payload.videoChapterId !== undefined) {
                state.activePasteEvaluation.videoChapterId = action.payload.videoChapterId;
            }
            if (action.payload.aiQuestionTimestamp !== undefined) {
                state.activePasteEvaluation.aiQuestionTimestamp = action.payload.aiQuestionTimestamp;
            }
            if (action.payload.evaluationReasoning !== undefined) {
                state.activePasteEvaluation.evaluationReasoning = action.payload.evaluationReasoning;
            }
            if (action.payload.evaluationCaption !== undefined) {
                state.activePasteEvaluation.evaluationCaption = action.payload.evaluationCaption;
            }
            if (action.payload.accountabilityScore !== undefined) {
                state.activePasteEvaluation.accountabilityScore = action.payload.accountabilityScore;
            }
            if (action.payload.questionScores !== undefined) {
                state.activePasteEvaluation.questionScores = action.payload.questionScores;
            }
            if (action.payload.topics !== undefined) {
                state.activePasteEvaluation.topics = action.payload.topics;
            }
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
    resetAll,
    setPendingReply,
    setTimebox,
    startPasteEvaluation,
    updatePasteEvaluation,
    clearPasteEvaluation,
} = codingSlice.actions;

export default codingSlice.reducer;
