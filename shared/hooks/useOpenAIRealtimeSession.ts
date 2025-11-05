/**
 * useOpenAIRealtimeSession: minimal session hook for OpenAI Realtime WebRTC.
 * - Connects via ephemeral key; configures transport transcription/VAD.
 * - Buffers transport events into ordered final messages via internal TurnBuffer.
 * - Returns {connected, session, connect}; invokes onFinal for flushed items.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { FinalMessage } from "../types/openAIRealtime";
import { log } from "app/shared/services";

// Local lightweight TurnBuffer implementation (ordered, emits per-arrival)
type TurnRecord = {
    user?: string;
    ai?: string;
    userEmitted?: boolean;
    aiEmitted?: boolean;
};
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

    function maybeFlushCompleted(turn: number): FinalMessage[] {
        const out: FinalMessage[] = [];
        const rec = turns.get(turn);
        if (!rec) return out;
        if (rec.userEmitted && rec.aiEmitted) {
            clearTimer(turn);
            turns.delete(turn);
        }
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
                if (!rec.userEmitted) {
                    flushed.push({
                        role: "user",
                        text,
                        turn: turnCounter,
                        ts: Date.now(),
                    });
                    rec.userEmitted = true;
                }
                flushed.push(...maybeFlushCompleted(turnCounter));
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
            if (!rec.aiEmitted && full) {
                flushed.push({
                    role: "ai",
                    text: full,
                    turn: targetTurn,
                    ts: Date.now(),
                });
                rec.aiEmitted = true;
            }
            flushed.push(...maybeFlushCompleted(targetTurn));
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
            turn_detection: null,
            input_audio_transcription: { model: "whisper-1", language: "en" },
        });
    } catch {}
}

export function useOpenAIRealtimeSession(
    onFinal?: (m: FinalMessage) => void,
    opts?: { agentName?: string; instructions?: string }
) {
    const [connected, setConnected] = useState(false);
    const sessionRef = useRef<any>(null);
    const transportHandlerRef = useRef<any>(null);
    const bufferRef = useRef(createTurnBuffer());
    const allowNextRef = useRef<boolean>(false);
    const handsFreeRef = useRef<boolean>(false);

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
                // Do not pass instructions; we will inject system text only when replying
            });
            const session: any = new RealtimeSession(agent, {
                model: "gpt-4o-realtime-preview-2024-12-17",
                outputModalities: ["audio", "text"],
                voice: process.env.OPENAI_VOICE || "alloy",
            } as any);
            await session.connect({ apiKey });
            sessionRef.current = session;
            updateTranscriptionConfig(session);

            const handler = (evt: any) => {
                // Cancel unsolicited replies immediately unless explicitly allowed
                if (
                    evt?.type === "response.created" ||
                    evt?.type === "response.output_text.delta"
                ) {
                    if (!allowNextRef.current) {
                        try {
                            sessionRef.current?.transport?.sendEvent?.({
                                type: "response.cancel",
                            });
                        } catch {}
                        return;
                    }
                }
                if (evt?.type === "response.done") {
                    allowNextRef.current = false; // close gate after any response finishes
                }
                if (
                    evt?.type ===
                        "conversation.item.input_audio_transcription.completed" ||
                    evt?.type === "response.done"
                ) {
                    const flushed = add(evt);
                    if (flushed && onFinal) flushed.forEach(onFinal);
                }
                // Hands-free: immediately trigger reply when user's transcript completes
                if (
                    evt?.type ===
                        "conversation.item.input_audio_transcription.completed" &&
                    handsFreeRef.current
                ) {
                    allowNextRef.current = true;
                    try {
                        sessionRef.current?.transport?.sendEvent?.({
                            type: "response.create",
                        });
                    } catch {}
                }
            };
            (session.on as any)?.("transport_event", handler);
            transportHandlerRef.current = handler;
            log.info("[openai][hook] connected; handler attached");
            setConnected(true);
        } catch (e) {
            setConnected(false);
            throw e;
        }
    }, [add, connected, onFinal, opts?.agentName]);

    useEffect(
        () => () => {
            try {
                reset();
                try {
                    const off = (sessionRef.current?.off as any);
                    if (off && transportHandlerRef.current) {
                        off("transport_event", transportHandlerRef.current);
                    }
                } catch {}
                log.info("[openai][hook] unmount cleanup: disconnect");
                sessionRef.current?.disconnect?.();
                sessionRef.current = null;
            } catch {}
        },
        [reset]
    );

    const respond = useCallback(() => {
        allowNextRef.current = true;
        try {
            sessionRef.current?.transport?.sendEvent?.({
                type: "response.create",
            });
        } catch {}
    }, []);

    const allowNextResponse = useCallback(() => {
        allowNextRef.current = true;
    }, []);

    return {
        connected,
        session: sessionRef,
        connect,
        respond,
        allowNextResponse,
        enableHandsFree: () => {
            handsFreeRef.current = true;
        },
        disableHandsFree: () => {
            handsFreeRef.current = false;
        },
        destroy: () => {
            log.info("[openai][hook] destroy() called");
            try {
                reset();
            } catch {}
            try {
                const off = (sessionRef.current?.off as any);
                if (off && transportHandlerRef.current) {
                    off("transport_event", transportHandlerRef.current);
                }
            } catch {}
            try {
                sessionRef.current?.disconnect?.();
            } catch {}
            sessionRef.current = null;
            allowNextRef.current = false;
            handsFreeRef.current = false;
            setConnected(false);
            log.info("[openai][hook] destroy() completed");
        },
    };
}
