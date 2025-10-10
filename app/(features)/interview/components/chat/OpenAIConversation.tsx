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
import { store } from "@/shared/state/store";
import { OPENAI_INTERVIEWER_PROMPT } from "@/shared/prompts/openAIInterviewerPrompt";
import { useDispatch } from "react-redux";
import {
    addMessage,
    setRecording,
} from "@/shared/state/slices/interviewChatSlice";
import {
    start as machineStart,
    aiFinal as machineAiFinal,
    userFinal as machineUserFinal,
    setExpectedBackgroundQuestion,
} from "@/shared/state/slices/interviewMachineSlice";
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
        const dispatch = useDispatch();
        const didConnectRef = useRef<boolean>(false);
        const didStartRef = useRef<boolean>(false);
        const didAskBackgroundRef = useRef<boolean>(false);

        const notifyRecording = useCallback(
            (val: boolean) => {
                dispatch(setRecording(val));
            },
            [dispatch]
        );

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
                dispatch(addMessage({ text, speaker }));
            },
            [dispatch]
        );

        // Compose: realtime session + interview state store
        const emitMachineState = useCallback(() => {
            try {
                const ms = store.getState().interviewMachine;
                const state = ms.state;
                const context = { candidateName: ms.candidateName };
                // eslint-disable-next-line no-console
                console.log("[interview-machine]", state, context);
                window.parent.postMessage(
                    { type: "interview-machine", state, context },
                    "*"
                );
            } catch {}
        }, []);
        const scriptRef = useRef<null>(null);
        const expectingUserRef = useRef<boolean>(false);
        const { connected, session, connect, respond } =
            useOpenAIRealtimeSession(
                (m) => {
                    if (m.role === "user") {
                        try {
                            dispatch(machineUserFinal());
                            emitMachineState();
                            postToChat(m.text, m.role);
                            const ms = store.getState().interviewMachine;
                            const expectedQ = (scriptRef.current as any)
                                ?.backgroundQuestion;
                            if (
                                ms.state === "greeting_responded_by_user" &&
                                expectedQ &&
                                !didAskBackgroundRef.current
                            ) {
                                const text = `Ask exactly: "${String(
                                    expectedQ
                                )}"`;
                                session.current?.transport?.sendEvent?.({
                                    type: "conversation.item.create",
                                    item: {
                                        type: "message",
                                        role: "system",
                                        content: [{ type: "input_text", text }],
                                    },
                                });
                                // respond gated
                                try {
                                    respond();
                                } catch {}
                                didAskBackgroundRef.current = true;
                            }
                            // If user just answered the background question → present coding challenge next
                            if (
                                ms.state === "background_answered_by_user" &&
                                (scriptRef.current as any)?.codingPrompt
                            ) {
                                const text = `Present the coding challenge exactly as follows, then wait for questions: "${String(
                                    (scriptRef.current as any).codingPrompt
                                )}"`;
                                session.current?.transport?.sendEvent?.({
                                    type: "conversation.item.create",
                                    item: {
                                        type: "message",
                                        role: "system",
                                        content: [{ type: "input_text", text }],
                                    },
                                });
                                try {
                                    respond();
                                } catch {}
                            }
                        } catch {}
                    } else if (m.role === "ai") {
                        try {
                            dispatch(machineAiFinal({ text: m.text }));
                            emitMachineState();
                            postToChat(m.text, m.role);
                            // After AI turn, expect user and clear input buffer to avoid overlap
                            try {
                                const ms = store.getState().interviewMachine;
                                if (
                                    ms.state === "greeting_said_by_ai" ||
                                    ms.state === "background_asked_by_ai"
                                ) {
                                    session.current?.transport?.sendEvent?.({
                                        type: "input_audio_buffer.clear",
                                    });
                                    expectingUserRef.current = true;
                                }
                                // When coding challenge is presented, enable auto turns
                                if (
                                    ms.state ===
                                    "coding_challenge_presented_by_ai"
                                ) {
                                    session.current?.transport?.updateSessionConfig?.(
                                        {
                                            audio: {
                                                input: {
                                                    transcription: {
                                                        model: "whisper-1",
                                                    },
                                                    turnDetection: {
                                                        type: "server_vad",
                                                    },
                                                },
                                            },
                                        }
                                    );
                                }
                            } catch {}
                        } catch {}
                    }
                },
                { agentName: "Carrie" }
            );

        // --- connect & wire -----------------------------------------------------
        const connectLegacy = useCallback(async () => {
            if (didConnectRef.current) return;
            didConnectRef.current = true;
            try {
                // Use new hook
                await connect();
                sessionRef.current = session.current;
                // Load interview script dynamically (company/role can come from params in future)
                try {
                    const resp = await fetch(
                        `/api/interviews/script?company=meta&role=frontend-engineer`
                    );
                    if (resp.ok) {
                        const data = await resp.json();
                        scriptRef.current = data;
                        if (data?.backgroundQuestion) {
                            dispatch(
                                setExpectedBackgroundQuestion({
                                    question: String(data.backgroundQuestion),
                                })
                            );
                        }
                    }
                } catch {}
                // If transport didn't auto-attach mic, attach our noise-suppressed track
                try {
                    const track = micStreamRef.current?.getAudioTracks?.()[0];
                    if (track && (session as any)?.addInputTrack) {
                        (session as any).addInputTrack(track);
                    }
                } catch {}

                // Start: enqueue deterministic greeting (once)
                if (!didStartRef.current) {
                    dispatch(machineStart({ candidateName }));
                    const name = candidateName || "Candidate";
                    const text = `Say exactly: "Hi ${name}, I'm Carrie. I'll be the one interviewing today!"`;
                    sessionRef.current?.transport?.sendEvent?.({
                        type: "conversation.item.create",
                        item: {
                            type: "message",
                            role: "system",
                            content: [{ type: "input_text", text }],
                        },
                    });
                    try {
                        respond();
                    } catch {}
                    didStartRef.current = true;
                }
                emitMachineState();
                setIsConnected(true);
                onStartConversation?.();
            } catch (e) {
                log.error("❌ OpenAIConversation: connect failed", e);
            }
        }, [
            candidateName,
            connect,
            emitMachineState,
            onStartConversation,
            session,
            dispatch,
        ]);

        useEffect(() => {
            if (isRecording && !isConnected) {
                void connectLegacy();
            }
        }, [isRecording, isConnected]);

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
            try {
                // @ts-ignore expose redux store for inspection
                (window as any).__sfinxStore = store;
            } catch {}
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
