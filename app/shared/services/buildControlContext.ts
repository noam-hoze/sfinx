import { interviewChatStore } from "../../../shared/state/interviewChatStore";

/**
 * Build up to the last K messages (overall, not per-speaker), preserving
 * chronological order, mapped to Chat Completions roles.
 */
export function buildControlContextMessages(k: number) {
    const { messages } = interviewChatStore.getState();
    // Filter out paste evaluation messages to keep main interview context clean
    const filtered = messages.filter(m => !m.isPasteEval);
    const slice = filtered.slice(-Math.max(1, k));
    return slice.map((m) => ({
        role: m.speaker === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text,
    }));
}

/**
 * Build delta-only scoring context:
 * - Returns a tuple of [systemMessage, assistantMessage, userMessage]
 * - System message embeds (read-only) a truncated prior history for reference only
 * - The only scorable content is the last user answer; the assistant turn is the last AI question
 */
export function buildDeltaControlMessages(k: number) {
    const { messages } = interviewChatStore.getState();
    if (!messages.length) return { system: "", assistant: "", user: "" };

    // Find last user answer
    let uIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].speaker === "user") { uIdx = i; break; }
    }
    const user = uIdx >= 0 ? messages[uIdx].text : "";

    // Find most recent assistant question before that
    let aIdx = -1;
    for (let i = uIdx - 1; i >= 0; i--) {
        if (messages[i].speaker === "ai") { aIdx = i; break; }
    }
    const assistant = aIdx >= 0 ? messages[aIdx].text : "";

    // Build read-only prior history (before the last assistant turn)
    const start = Math.max(0, aIdx - Math.max(0, k));
    const prior = messages.slice(start, Math.max(0, aIdx)).map((m) => `${m.speaker}: ${m.text}`).join("\n");

    const system = `Reference history (READ-ONLY, DO NOT SCORE past turns):\n${prior}`;
    return { system, assistant, user };
}


