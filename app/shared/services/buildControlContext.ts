import { interviewChatStore } from "../../../shared/state/interviewChatStore";

/**
 * Build up to the last K messages (overall, not per-speaker), preserving
 * chronological order, mapped to Chat Completions roles.
 */
export function buildControlContextMessages(k: number) {
    const { messages } = interviewChatStore.getState();
    const slice = messages.slice(-Math.max(1, k));
    return slice.map((m) => ({
        role: m.speaker === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text,
    }));
}


