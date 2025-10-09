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
                    audio: {
                        input: {
                            transcription: { model: "whisper-1" },
                            turnDetection: { type: "server_vad" },
                        },
                    },
                    // Try enabling text delta emission if supported
                    transcribedTextDeltas: true as any,
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

                // Transcript listeners (conversation mode)
                const post = (text: string, speaker: "user" | "ai") => {
                    if (!text) return;
                    try {
                        window.parent.postMessage(
                            { type: "transcription", text, speaker },
                            "*"
                        );
                    } catch (_) {}
                };

                const userTextBuffer: { current: string } = { current: "" };
                const aiTextBuffer: { current: string } = { current: "" };

                // User speech transcription (input audio)
                (session.on as any)?.(
                    "conversation.item.input_audio_transcription.delta",
                    (e: any) => {
                        const delta = e?.delta || "";
                        userTextBuffer.current += delta;
                    }
                );
                (session.on as any)?.(
                    "conversation.item.input_audio_transcription.completed",
                    (e: any) => {
                        
                        console.log("I see a user message")
                        const text =
                            e?.transcript || userTextBuffer.current || "";
                        userTextBuffer.current = "";
                        post(text, "user");
                    }
                );

                // AI text output (if text modality enabled)
                (session.on as any)?.(
                    "response.output_text.delta",
                    (e: any) => {
                        const delta = e?.delta || "";
                        aiTextBuffer.current += delta;
                    }
                );
                (session.on as any)?.(
                    "response.output_text.done",
                    (_e: any) => {
                        const text = aiTextBuffer.current;
                        aiTextBuffer.current = "";
                        post(text, "ai");
                    }
                );

                // AI audio transcript (when speaking)
                (session.on as any)?.(
                    "response.output_audio_transcript.delta",
                    (e: any) => {
                        const delta = e?.delta || "";
                        aiTextBuffer.current += delta;
                    }
                );
                (session.on as any)?.(
                    "response.output_audio_transcript.done",
                    (_e: any) => {
                        const text = aiTextBuffer.current;
                        aiTextBuffer.current = "";
                        post(text, "ai");
                    }
                );

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
