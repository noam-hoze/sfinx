import type {
    FinalMessage,
    TurnBuffer,
    TurnRecord,
} from "../types/openAIRealtime";

export function createTurnBuffer(options?: { graceMs?: number }): TurnBuffer {
    const graceMs = options?.graceMs ?? 400;
    let turnCounter = 0;
    const turns = new Map<number, TurnRecord>();
    const timers = new Map<number, number>();

    function ensureTurn(turn: number) {
        if (!turns.has(turn)) turns.set(turn, {});
        return turns.get(turn)!;
    }

    function flush(turn: number): FinalMessage[] {
        const out: FinalMessage[] = [];
        const rec = turns.get(turn);
        if (!rec) return out;
        const ts = Date.now();
        if (typeof rec.user === "string")
            out.push({ role: "user", text: rec.user, turn, ts });
        if (typeof rec.ai === "string")
            out.push({ role: "ai", text: rec.ai, turn, ts });
        clearTimer(turn);
        turns.delete(turn);
        return out;
    }

    function clearTimer(turn: number) {
        const id = timers.get(turn);
        if (id) {
            clearTimeout(id as unknown as number);
            timers.delete(turn);
        }
    }

    function scheduleFlush(turn: number): void {
        if (timers.has(turn)) return;
        const id = setTimeout(() => {
            flush(turn);
        }, graceMs) as unknown as number;
        timers.set(turn, id);
    }

    function ingest(evt: any): FinalMessage[] {
        const flushed: FinalMessage[] = [];
        // User transcript ⇒ start a new turn and attach user text
        if (
            evt?.type ===
            "conversation.item.input_audio_transcription.completed"
        ) {
            const text =
                evt.transcript ??
                evt.item?.transcript ??
                evt.item?.content?.[0]?.transcript ??
                evt.item?.content?.[0]?.text ??
                null;
            if (text) {
                turnCounter += 1;
                const rec = ensureTurn(turnCounter);
                rec.user = text;
                if (typeof rec.ai === "string")
                    flushed.push(...flush(turnCounter));
            }
            return flushed;
        }
        // Assistant final ⇒ attach to most recent turn without AI; if none, pre-create next turn
        if (evt?.type === "response.done") {
            const items = evt?.response?.output ?? [];
            const parts: string[] = [];
            for (const it of items) {
                const content = it?.content ?? [];
                for (const c of content) {
                    if (typeof c?.text === "string") parts.push(c.text);
                    else if (typeof c?.transcript === "string")
                        parts.push(c.transcript);
                }
            }
            const full = parts.join("").trim();
            let targetTurn = 0;
            for (let t = turnCounter; t >= 1; t--) {
                const rec = turns.get(t);
                if (
                    rec &&
                    typeof rec.user === "string" &&
                    typeof rec.ai === "undefined"
                ) {
                    targetTurn = t;
                    break;
                }
            }
            if (targetTurn === 0) targetTurn = turnCounter + 1;
            const rec = ensureTurn(targetTurn);
            if (full) rec.ai = full;
            if (rec.user) flushed.push(...flush(targetTurn));
            else scheduleFlush(targetTurn);
            return flushed;
        }
        return flushed;
    }

    function reset(): void {
        turns.clear();
        timers.forEach((id) => clearTimeout(id as unknown as number));
        timers.clear();
        turnCounter = 0;
    }

    return { ingest, reset };
}
