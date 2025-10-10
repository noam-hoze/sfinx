/**
 * useOpenAIRealtimeSession: minimal session hook for OpenAI Realtime WebRTC.
 * - Connects via ephemeral key; configures transport transcription/VAD.
 * - Buffers transport events into ordered final messages via internal TurnBuffer.
 * - Returns {connected, session, connect}; invokes onFinal for flushed items.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { FinalMessage } from "../types/openAIRealtime";

// Local lightweight TurnBuffer implementation (previously in services)
type TurnRecord = { user?: string; ai?: string };
function createTurnBuffer(options?: { graceMs?: number }) {
    const graceMs = options?.graceMs ?? 400;
    let turnCounter = 0;
    const turns = new Map<number, TurnRecord>();
    const timers = new Map<number, number>();

    function ensureTurn(turn: number) {
        if (!turns.has(turn)) turns.set(turn, {});
        return turns.get(turn)!;
    }

    function clearTimer(turn: number) {
        const id = timers.get(turn);
        if (id) {
            clearTimeout(id as unknown as number);
            timers.delete(turn);
        }
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

    function ingest(evt: any): FinalMessage[] {
        const flushed: FinalMessage[] = [];
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
            if (targetTurn === 0) {
                turnCounter += 1;
                targetTurn = turnCounter;
            }
            const rec = ensureTurn(targetTurn);
            if (full) rec.ai = full;
            flushed.push(...flush(targetTurn));
            return flushed;
        }
        return flushed;
    }

    function reset() {
        turns.clear();
        timers.forEach((id) => clearTimeout(id as unknown as number));
        timers.clear();
        turnCounter = 0;
    }

    return { ingest, reset };
}

// Inline transport config helper
function updateTranscriptionConfig(session: any) {
    try {
        session?.transport?.updateSessionConfig?.({
            audio: {
                input: {
                    transcription: { model: "whisper-1" },
                    turnDetection: { type: "server_vad" },
                },
            },
        });
    } catch {}
}

export function useOpenAIRealtimeSession(
    onFinal?: (m: FinalMessage) => void,
    opts?: { agentName?: string; instructions?: string }
) {
    const [connected, setConnected] = useState(false);
    const sessionRef = useRef<any>(null);
    const bufferRef = useRef(createTurnBuffer());

    const add = useCallback((evt: any) => bufferRef.current.ingest(evt), []);
    const reset = useCallback(() => bufferRef.current.reset(), []);

    const connect = useCallback(async () => {
        if (connected) return;
        try {
            const res = await fetch("/api/openai/realtime", { method: "POST" });
            if (!res.ok) throw new Error(await res.text());
            const { value: apiKey } = await res.json();
            if (!apiKey) throw new Error("Missing ephemeral key");

            const { RealtimeAgent, RealtimeSession } = await import(
                "@openai/agents/realtime"
            );
            const agent = new RealtimeAgent({
                name: opts?.agentName || "Carrie",
                instructions: opts?.instructions,
            });
            const session: any = new RealtimeSession(agent, {
                model: "gpt-4o-realtime-preview",
                outputModalities: ["audio", "text"],
            } as any);
            await session.connect({ apiKey });
            sessionRef.current = session;
            updateTranscriptionConfig(session);

            (session.on as any)?.("transport_event", (evt: any) => {
                if (
                    evt?.type ===
                        "conversation.item.input_audio_transcription.completed" ||
                    evt?.type === "response.done"
                ) {
                    const flushed = add(evt);
                    if (flushed && onFinal) flushed.forEach(onFinal);
                }
            });
            setConnected(true);
        } catch (e) {
            setConnected(false);
            throw e;
        }
    }, [add, connected, onFinal, opts?.agentName, opts?.instructions]);

    useEffect(
        () => () => {
            try {
                reset();
                sessionRef.current?.disconnect?.();
            } catch {}
        },
        [reset]
    );

    return { connected, session: sessionRef, connect };
}
