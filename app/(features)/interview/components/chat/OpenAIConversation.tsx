"use client";

import React, {
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
    forwardRef,
} from "react";
import { logger } from "../../../../shared/services";
import { createTurnBuffer } from "@/shared/services/openAIRealtimeTurnBuffer";
import {
    extractAssistantFinalText,
    extractUserTranscript,
} from "@/shared/services/openAIRealtimeExtractors";
const log = logger.for("@OpenAIConversation.tsx");

interface OpenAIConversationProps {
    onStartConversation?: () => void;
    onEndConversation?: () => void;
    onInterviewConcluded?: () => void;
    isInterviewActive?: boolean;
    candidateName?: string;
    handleUserTranscript?: (transcript: string) => Promise<void>;
    updateKBVariables?: (updates: any) => Promise<void>;
    kbVariables?: any;
    automaticMode?: boolean;
    onAutoStartCoding?: () => void;
}

/**
 * Minimal OpenAI Realtime adapter (WebRTC) matching RealTimeConversation API shape.
 * - Connects using ephemeral key from /api/openai/realtime
 * - Posts basic recording status to parent for ChatPanel indicator
 * - Stubs sendUserMessage/sendContextualUpdate (to be extended)
 */
const OpenAIConversation = forwardRef<any, OpenAIConversationProps>(
    (
        {
            onStartConversation,
            onEndConversation,
            isInterviewActive = false,
            candidateName = "Candidate",
            updateKBVariables,
        },
        ref
    ) => {
        const [isConnected, setIsConnected] = useState(false);
        const [isRecording, setIsRecording] = useState(false);
        const micStreamRef = useRef<MediaStream | null>(null);
        const sessionRef = useRef<any>(null);
        const micMutedRef = useRef<boolean>(false);

        const notifyRecording = useCallback((val: boolean) => {
            window.parent.postMessage(
                { type: "recording-status", isRecording: val },
                "*"
            );
        }, []);

        const startConversation = useCallback(async () => {
            try {
                // Request mic perms upfront for UX parity with EL adapter
                const micStream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
                micStreamRef.current = micStream;
                setIsRecording(true);
                notifyRecording(true);
            } catch (err) {
                log.error("❌ OpenAIConversation: mic permission error", err);
            }
        }, [notifyRecording]);

        const connect = useCallback(async () => {
            try {
                const res = await fetch("/api/openai/realtime", {
                    method: "POST",
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || "Failed to mint ephemeral key");
                }
                const { value: apiKey } = await res.json();
                if (!apiKey)
                    throw new Error("Missing ephemeral key in response");

                const { RealtimeAgent, RealtimeSession } = await import(
                    "@openai/agents/realtime"
                );
                const agent = new RealtimeAgent({
                    name: "Assistant",
                    instructions: "You are a helpful assistant.",
                });
                const session = new RealtimeSession(agent, {
                    model: "gpt-4o-realtime-preview",
                    outputModalities: ["audio", "text"],
                } as any);

                // Connect
                // eslint-disable-next-line no-console
                console.info("[OpenAIConversation] connecting...");
                await session.connect({ apiKey });
                sessionRef.current = session;
                // eslint-disable-next-line no-console
                console.info("[OpenAIConversation] connected", {
                    hasOn: typeof (session as any).on === "function",
                });
                // eslint-disable-next-line no-console
                console.info(
                    "[OpenAIConversation] session object below — expand to inspect handlers"
                );
                // eslint-disable-next-line no-console
                console.dir(sessionRef.current);

                // Prime KB on connect
                updateKBVariables?.({
                    candidate_name: candidateName,
                    is_coding: false,
                    has_submitted: false,
                });

                // Transcript listeners (transport_event + turn buffer to preserve order)
                const post = (text: string, speaker: "user" | "ai") => {
                    if (!text) return;
                    try {
                        window.parent.postMessage(
                            { type: "transcription", text, speaker },
                            "*"
                        );
                    } catch (_) {}
                };

                // Align with POC: configure transcription + server VAD after connect via transport
                try {
                    (session as any)?.transport?.updateSessionConfig?.({
                        audio: {
                            input: {
                                transcription: { model: "whisper-1" },
                                turnDetection: { type: "server_vad" },
                            },
                        },
                    });
                } catch {}

                const turnBuffer = createTurnBuffer();
                (session.on as any)?.("transport_event", (evt: any) => {
                    if (
                        evt?.type ===
                        "conversation.item.input_audio_transcription.completed"
                    ) {
                        // Normalize via extractor (handles variant payloads)
                        const text = extractUserTranscript(evt);
                        if (text) {
                            const flushed = turnBuffer.ingest(evt);
                            for (const m of flushed) post(m.text, m.role);
                        }
                        return;
                    }
                    if (evt?.type === "response.done") {
                        // Ensure assistant final text available; buffer handles attachment
                        const _text = extractAssistantFinalText(evt);
                        const flushed = turnBuffer.ingest(evt);
                        for (const m of flushed) post(m.text, m.role);
                        return;
                    }
                });

                // (removed agent-level diagnostics; not needed for PoC)

                setIsConnected(true);
                onStartConversation?.();
            } catch (e) {
                log.error("❌ OpenAIConversation: connect failed", e);
            }
        }, [candidateName, onStartConversation, updateKBVariables]);

        useEffect(() => {
            if (isRecording && !isConnected) {
                void connect();
            }
        }, [isRecording, isConnected, connect]);

        const disconnect = useCallback(() => {
            try {
                if (micStreamRef.current) {
                    micStreamRef.current.getTracks().forEach((t) => t.stop());
                    micStreamRef.current = null;
                }
                setIsRecording(false);
                notifyRecording(false);
                if (sessionRef.current?.disconnect) {
                    sessionRef.current.disconnect();
                }
            } catch (_) {}
            setIsConnected(false);
            onEndConversation?.();
        }, [notifyRecording, onEndConversation]);

        const toggleMicMute = useCallback(() => {
            // Not yet wired to SDK input; reflect state to UI only
            micMutedRef.current = !micMutedRef.current;
            window.parent.postMessage(
                { type: "mic-state-changed", micMuted: micMutedRef.current },
                "*"
            );
        }, []);

        const sendUserMessage = useCallback(async (_message: string) => {
            log.warn("OpenAIConversation.sendUserMessage not yet implemented");
            return false;
        }, []);

        useImperativeHandle(ref, () => ({
            startConversation,
            stopConversation: disconnect,
            sendContextualUpdate: async (_text: string) => {
                log.warn(
                    "OpenAIConversation.sendContextualUpdate not yet implemented"
                );
            },
            sendUserMessage,
            micMuted: micMutedRef.current,
            toggleMicMute,
        }));

        useEffect(() => {
            return () => {
                if (micStreamRef.current) {
                    micStreamRef.current.getTracks().forEach((t) => t.stop());
                    micStreamRef.current = null;
                }
                if (sessionRef.current?.disconnect) {
                    sessionRef.current.disconnect();
                }
            };
        }, []);

        return (
            <div className="w-full max-w-4xl mx-auto">
                <div className="text-center text-gray-400">
                    <p>
                        {isConnected
                            ? isInterviewActive
                                ? "Listening..."
                                : "Connected"
                            : "Disconnected"}
                    </p>
                </div>
            </div>
        );
    }
);

OpenAIConversation.displayName = "OpenAIConversation";

export default OpenAIConversation;
