import { interviewChatStore } from "../../../shared/state/interviewChatStore";

/**
 * Build last K alternating user/assistant messages for Chat Completions.
 * Returns items in chronological order.
 */
export function buildControlContextMessages(k: number) {
    const { messages } = interviewChatStore.getState();
    const lastUsers = messages.filter((m) => m.speaker === "user");
    const lastAis = messages.filter((m) => m.speaker === "ai");
    const n = Math.min(lastUsers.length, lastAis.length, Math.max(1, k));
    const userKeep = new Set(lastUsers.slice(-n).map((m) => m.id));
    const aiKeep = new Set(lastAis.slice(-n).map((m) => m.id));
    const selected = messages.filter((m) =>
        m.speaker === "user" ? userKeep.has(m.id) : aiKeep.has(m.id)
    );
    return selected.map((m) => ({
        role: m.speaker === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text,
    }));
}


