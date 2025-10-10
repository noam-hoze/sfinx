"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export default function RealtimePOCPage() {
    const [status, setStatus] = useState<
        "idle" | "connecting" | "connected" | "error"
    >("idle");
    const [error, setError] = useState<string | null>(null);
    const connectRef = useRef<() => void>(() => {});
    // Turn-based buffer: keep user/ai texts per turn and flush in order
    const turnCounterRef = useRef<number>(0);
    const lastCommittedTurnRef = useRef<number>(0);
    const lastResponseTurnRef = useRef<number | null>(null);
    const turnsRef = useRef<Record<number, { user?: string; ai?: string }>>({});
    const flushTimersRef = useRef<Record<number, number>>({});
    const flushTurn = (turn: number) => {
        const rec = turnsRef.current[turn];
        if (!rec) return;
        if (typeof rec.user === "string") console.log("User:", rec.user);
        if (typeof rec.ai === "string") console.log("AI:", rec.ai);
        delete turnsRef.current[turn];
        if (flushTimersRef.current[turn]) {
            window.clearTimeout(flushTimersRef.current[turn]);
            delete flushTimersRef.current[turn];
        }
    };
    const scheduleFlushTurn = (turn: number, delayMs = 350) => {
        if (flushTimersRef.current[turn]) return;
        flushTimersRef.current[turn] = window.setTimeout(() => {
            flushTurn(turn);
        }, delayMs);
    };

    const connect = useCallback(async () => {
        setStatus("connecting");
        setError(null);
        try {
            const res = await fetch("/api/openai/realtime", { method: "POST" });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "Failed to fetch ephemeral key");
            }
            const { value: apiKey } = await res.json();
            if (!apiKey) throw new Error("Missing ephemeral key in response");

            // Dynamically import to avoid SSR issues if we later add SDK usage
            const { RealtimeAgent, RealtimeSession } = await import(
                "@openai/agents/realtime"
            );
            const agent = new RealtimeAgent({
                name: "Assistant",
                instructions: "You are a helpful assistant.",
            });
            const session: any = new RealtimeSession(agent, {
                model: "gpt-realtime",
                voice: "verse",
                modalities: ["text", "audio"],
            } as any);
            await session.connect({ apiKey });
            // Send session.update via transport using the GA config shape
            try {
                session.transport?.updateSessionConfig?.({
                    audio: {
                        input: {
                            transcription: { model: "whisper-1" },
                            turnDetection: { type: "server_vad" },
                        },
                    },
                });
            } catch (e) {
                // Fallback: send raw session.update event
                session.transport?.sendEvent?.({
                    type: "session.update",
                    session: {
                        type: "realtime",
                        input_audio_transcription: { model: "whisper-1" },
                        turn_detection: { type: "server_vad" },
                    },
                });
            }

            // (Optional) ensure we have an input mic track if SDK didn’t auto-attach
            if (
                !session.hasInputAudioTrack?.() &&
                typeof navigator !== "undefined"
            ) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                    });
                    const [track] = stream.getAudioTracks();
                    if (track) session.addInputTrack?.(track);
                } catch (e) {
                    console.warn("Mic attach failed:", e);
                }
            }

            // Transcription and final message events (listen to transport_event)
            session.on("transport_event", (evt: any) => {
                // Mark user turn boundaries
                if (evt?.type === "input_audio_buffer.committed") {
                    turnCounterRef.current += 1;
                    lastCommittedTurnRef.current = turnCounterRef.current;
                    if (!turnsRef.current[lastCommittedTurnRef.current])
                        turnsRef.current[lastCommittedTurnRef.current] = {};
                } else if (evt?.type === "response.created") {
                    // Associate upcoming assistant response with the latest committed user turn
                    lastResponseTurnRef.current =
                        lastCommittedTurnRef.current || turnCounterRef.current;
                }
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
                        // Attach to the oldest turn without a user transcript
                        for (let t = 1; t <= turnCounterRef.current; t++) {
                            const rec = turnsRef.current[t];
                            if (rec && typeof rec.user === "undefined") {
                                rec.user = text;
                                break;
                            }
                        }
                    }
                } else if (
                    evt?.type ===
                    "conversation.item.input_audio_transcription.failed"
                ) {
                    console.error("ASR failed:", evt);
                } else if (evt?.type === "response.done") {
                    try {
                        const items = evt?.response?.output ?? [];
                        const parts: string[] = [];
                        for (const it of items) {
                            const content = it?.content ?? [];
                            for (const c of content) {
                                if (typeof c?.text === "string")
                                    parts.push(c.text);
                                else if (typeof c?.transcript === "string")
                                    parts.push(c.transcript);
                            }
                        }
                        const full = parts.join("").trim();
                        const turn =
                            lastResponseTurnRef.current ||
                            lastCommittedTurnRef.current ||
                            turnCounterRef.current ||
                            1;
                        if (!turnsRef.current[turn])
                            turnsRef.current[turn] = {};
                        if (full) turnsRef.current[turn].ai = full;
                        // If user already present, flush immediately; otherwise give it a short grace period
                        if (turnsRef.current[turn].user) flushTurn(turn);
                        else scheduleFlushTurn(turn, 400);
                    } catch (err) {
                        console.warn(
                            "Failed to parse AI final message:",
                            err,
                            evt
                        );
                    }
                }
            });

            // (Optional) quick check that session kept the setting
            session.on?.("session.updated", (s: any) =>
                console.log("Session updated:", s?.input_audio_transcription)
            );

            // Expose session for re-apply button
            (window as any).__openaiSession = session;
            setStatus("connected");
        } catch (e: any) {
            setStatus("error");
            setError(String(e?.message || e));
        }
    }, []);

    useEffect(() => {
        connectRef.current = connect;
    }, [connect]);

    const resendTranscriptionConfig = useCallback(async () => {
        try {
            const s = (window as any).__openaiSession;
            if (!s) throw new Error("No active session");
            if (s.transport?.updateSessionConfig) {
                s.transport.updateSessionConfig({
                    audio: {
                        input: {
                            transcription: { model: "whisper-1" },
                            turnDetection: { type: "server_vad" },
                        },
                    },
                });
                console.log(
                    "Re-sent transcription/VAD config via transport.updateSessionConfig"
                );
            } else if (s.transport?.sendEvent) {
                s.transport.sendEvent({
                    type: "session.update",
                    session: {
                        type: "realtime",
                        input_audio_transcription: { model: "whisper-1" },
                        turn_detection: { type: "server_vad" },
                    },
                });
                console.log(
                    "Re-sent transcription/VAD config via transport.sendEvent"
                );
            } else {
                console.warn(
                    "Transport lacks update methods; please update SDK"
                );
            }
        } catch (e) {
            console.error("Failed to resend transcription config:", e);
        }
    }, []);

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6">
            <h1 className="text-2xl font-semibold">
                Realtime Voice Agent (POC)
            </h1>
            <p className="text-sm text-gray-500">
                Grants mic permission on connect and starts a Realtime session.
            </p>
            <div className="flex items-center gap-3">
                <button
                    className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
                    onClick={() => connectRef.current()}
                    disabled={status === "connecting" || status === "connected"}
                >
                    {status === "idle" && "Connect"}
                    {status === "connecting" && "Connecting..."}
                    {status === "connected" && "Connected"}
                    {status === "error" && "Retry Connect"}
                </button>
                <button
                    className="rounded-md bg-gray-800 px-4 py-2 text-white disabled:opacity-50"
                    onClick={resendTranscriptionConfig}
                    disabled={status !== "connected"}
                >
                    Re-apply Transcription
                </button>
                <span className="text-sm">Status: {status}</span>
            </div>
            {error && (
                <pre className="whitespace-pre-wrap rounded-md bg-red-50 p-3 text-sm text-red-600">
                    {error}
                </pre>
            )}
        </div>
    );
}
