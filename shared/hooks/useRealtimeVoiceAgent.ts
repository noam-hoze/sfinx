import { useCallback, useEffect, useRef, useState } from "react";
import { createTurnBuffer } from "../services/realtimeTurnBuffer";
import {
    extractAssistantFinalText,
    extractUserTranscript,
} from "../services/realtimeExtractors";
import type { FinalMessage } from "../types/realtime";

export type UseRealtimeVoiceAgent = {
    status: "idle" | "connecting" | "connected" | "error";
    error: string | null;
    connect: () => Promise<void>;
    reapplyConfig: () => Promise<void>;
    onFinalMessage: (cb: (m: FinalMessage) => void) => void;
};

export function useRealtimeVoiceAgent(): UseRealtimeVoiceAgent {
    const [status, setStatus] = useState<
        "idle" | "connecting" | "connected" | "error"
    >("idle");
    const [error, setError] = useState<string | null>(null);
    const sessionRef = useRef<any>(null);
    const listenersRef = useRef<Array<(m: FinalMessage) => void>>([]);
    const bufferRef = useRef(createTurnBuffer());

    const notify = useCallback((msgs: FinalMessage[]) => {
        for (const m of msgs) {
            for (const cb of listenersRef.current) cb(m);
        }
    }, []);

    const connect = useCallback(async () => {
        setStatus("connecting");
        setError(null);
        try {
            const res = await fetch("/api/openai/realtime", { method: "POST" });
            if (!res.ok) throw new Error(await res.text());
            const { value: apiKey } = await res.json();
            if (!apiKey) throw new Error("Missing ephemeral key");

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

            // Configure transcription + VAD via transport
            session.transport?.updateSessionConfig?.({
                audio: {
                    input: {
                        transcription: { model: "whisper-1" },
                        turnDetection: { type: "server_vad" },
                    },
                },
            });

            // Attach events
            session.on("transport_event", (evt: any) => {
                // Ingest into buffer for ordered delivery
                const flushed = bufferRef.current.ingest(evt);
                if (flushed.length) notify(flushed);
                // Optional: expose raw extraction helpers if needed elsewhere
                if (
                    evt?.type ===
                    "conversation.item.input_audio_transcription.completed"
                ) {
                    extractUserTranscript(evt);
                } else if (evt?.type === "response.done") {
                    extractAssistantFinalText(evt);
                }
            });

            sessionRef.current = session;
            setStatus("connected");
        } catch (e: any) {
            setStatus("error");
            setError(String(e?.message || e));
        }
    }, [notify]);

    const reapplyConfig = useCallback(async () => {
        const s = sessionRef.current;
        if (!s) throw new Error("No active session");
        s.transport?.updateSessionConfig?.({
            audio: {
                input: {
                    transcription: { model: "whisper-1" },
                    turnDetection: { type: "server_vad" },
                },
            },
        });
    }, []);

    const onFinalMessage = useCallback((cb: (m: FinalMessage) => void) => {
        listenersRef.current.push(cb);
        return () => {
            listenersRef.current = listenersRef.current.filter((x) => x !== cb);
        };
    }, []);

    useEffect(() => {
        return () => {
            try {
                sessionRef.current?.close?.();
            } catch {}
        };
    }, []);

    return { status, error, connect, reapplyConfig, onFinalMessage };
}
