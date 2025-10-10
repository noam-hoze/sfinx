/**
 * OpenAIConversation: UI-free adapter wiring WebRTC Realtime into the interview flow.
 * - Requests mic, opens session via useOpenAIRealtimeSession, posts final texts to parent.
 * - Delegates deterministic flow to openAIFlowController (greeting → background → ack).
 * - Exposes imperative API for parent: start/stop, mic toggle, contextual updates.
 */
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
import { useOpenAIRealtimeSession } from "@/shared/hooks/useOpenAIRealtimeSession";
import { openAIFlowController } from "@/shared/services/openAIFlowController";
import { OPENAI_INTERVIEWER_PROMPT } from "@/shared/prompts/openAIInterviewerPrompt";
const log = logger.for("@OpenAIConversation.tsx");

interface OpenAIConversationProps {
    onStartConversation?: () => void;
    onEndConversation?: () => void;
    onInterviewConcluded?: () => void;
    isInterviewActive?: boolean;
    candidateName?: string;
    handleUserTranscript?: (transcript: string) => Promise<void>;
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
        },
        ref
    ) => {
        const [isConnected, setIsConnected] = useState(false);
        const [isRecording, setIsRecording] = useState(false);
        const micStreamRef = useRef<MediaStream | null>(null);
        const sessionRef = useRef<any>(null);
        const micMutedRef = useRef<boolean>(false);
        type Stage = "awaiting_ready" | "background_asked" | "background_done";
        const stageRef = useRef<Stage>("awaiting_ready");

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
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    } as MediaTrackConstraints,
                });
                micStreamRef.current = micStream;
                setIsRecording(true);
                notifyRecording(true);
            } catch (err) {
                log.error("❌ OpenAIConversation: mic permission error", err);
            }
        }, [notifyRecording]);

        // --- helpers ------------------------------------------------------------
        const postToChat = useCallback(
            (text: string, speaker: "user" | "ai") => {
                if (!text) return;
                try {
                    window.parent.postMessage(
                        { type: "transcription", text, speaker },
                        "*"
                    );
                } catch (_) {}
            },
            []
        );

        // Compose hooks/services: realtime session + flow controller
        const flow = openAIFlowController();
        const scriptRef = useRef<{
            backgroundQuestion?: string;
            codingPrompt?: string;
        } | null>(null);
        const { connected, session, connect } = useOpenAIRealtimeSession(
            (m) => {
                postToChat(m.text, m.role);
                if (m.role === "user") {
                    try {
                        flow.onUserFinal(
                            session.current,
                            scriptRef.current?.backgroundQuestion
                        );
                    } catch {}
                }
            },
            { agentName: "Carrie", instructions: OPENAI_INTERVIEWER_PROMPT }
        );

        // --- connect & wire -----------------------------------------------------
        const connectLegacy = useCallback(async () => {
            try {
                // Use new hook
                await connect();
                sessionRef.current = session.current;
                // Load interview script dynamically (company/role can come from params in future)
                try {
                    const resp = await fetch(
                        `/api/interviews/script?company=meta&role=frontend-engineer`
                    );
                    if (resp.ok) scriptRef.current = await resp.json();
                } catch {}
                // If transport didn't auto-attach mic, attach our noise-suppressed track
                try {
                    const track = micStreamRef.current?.getAudioTracks?.()[0];
                    if (track && (session as any)?.addInputTrack) {
                        (session as any).addInputTrack(track);
                    }
                } catch {}

                // Greet and proceed
                flow.greet(sessionRef.current, candidateName);
                setIsConnected(true);
                onStartConversation?.();
            } catch (e) {
                log.error("❌ OpenAIConversation: connect failed", e);
            }
        }, [candidateName, connect, flow, onStartConversation, session]);

        useEffect(() => {
            if (isRecording && !isConnected) {
                void connectLegacy();
            }
        }, [isRecording, isConnected, connectLegacy]);

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
