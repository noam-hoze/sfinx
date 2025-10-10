import { useCallback, useEffect, useRef, useState } from "react";
import { useTurnBuffer } from "./useTurnBuffer";
import { updateTranscriptionConfig } from "../services/openAITransport";
import type { FinalMessage } from "../types/openAIRealtime";

export function useOpenAIRealtimeSession(
    onFinal?: (m: FinalMessage) => void,
    opts?: { agentName?: string; instructions?: string }
) {
    const [connected, setConnected] = useState(false);
    const sessionRef = useRef<any>(null);
    const { add, reset } = useTurnBuffer();

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
    }, [add, connected, onFinal]);

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
