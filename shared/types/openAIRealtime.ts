export type RealtimeRole = "user" | "ai";

export type FinalMessage = {
    role: RealtimeRole;
    text: string;
    turn: number;
    ts: number;
};

export type TurnRecord = {
    user?: string;
    ai?: string;
};

export type TurnBuffer = {
    ingest: (evt: any) => FinalMessage[]; // returns flushed messages (ordered)
    reset: () => void;
};

// Conversation integration types for the OpenAI interviewer engine
export type OpenAIStatus = "disconnected" | "connecting" | "connected";

export type OpenAIEvent =
    | { type: "status"; status: OpenAIStatus }
    | { type: "transcript"; role: RealtimeRole; text: string; final: true }
    | { type: "speaking"; isSpeaking: boolean }
    | { type: "error"; error: unknown };

export type OpenAIStage = {
    isCoding?: boolean; // when true, editor should be visible and editable
    isInCodingQuestion?: boolean; // when true, agent should announce coding challenge
};