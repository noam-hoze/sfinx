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
