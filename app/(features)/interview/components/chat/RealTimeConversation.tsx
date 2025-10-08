"use client";

import React, {
    useEffect,
    useState,
    useCallback,
    forwardRef,
    useImperativeHandle,
    useRef,
} from "react";
import { useMicSession } from "./hooks/useMicSession";
import { useElevenLabsTransport } from "./hooks/useElevenLabsTransport";
import { useInterview } from "../../../../shared/contexts";
import AnimatedWaveform from "./AnimatedWaveform";
import { logger } from "../../../../shared/services";
import { useConversationRoleBehavior } from "./useConversationRoleBehavior";
import { useKBUpdates } from "./hooks/useKBUpdates";
import { useFlushQueues } from "./hooks/useFlushQueues";
import type { RoleConfig } from "../../../../shared/contexts/types";
import {
    startRecordingSession,
    sendAudioChunk,
    endRecordingSession,
    appendTranscriptLine,
    appendCodeSnapshot,
} from "../../../../shared/services/recordings";
const log = logger.for("@RealTimeConversation.tsx");

// Enable verbose logging for this module only
if (typeof window !== "undefined") {
    logger.setEnabled(true);
    logger.setNamespacedOnly(true);
    logger.setModules([
        "@RealTimeConversation.tsx",
        "@InterviewIDE.tsx",
        "@clientTools.ts",
        "@OpenAITextConversation.tsx",
        "@useOpenAiAsCandidate.ts",
        "@RightPanel.tsx",
    ]);
    logger.setLevels(["debug", "info", "warn", "error"]);
}

/**
 * Props for RealTimeConversation
 * - Bridges UI with ElevenLabs realtime session and the state machine.
 */
interface RealTimeConversationProps {
    onStartConversation?: () => void;
    onEndConversation?: () => void;
    onInterviewConcluded?: () => void;
    isInterviewActive?: boolean;
    candidateName?: string;
    roles?: RoleConfig; // default interviewer=elevenLabs, candidate=human
    // State machine functions passed from parent
    handleUserTranscript?: (transcript: string) => Promise<void>;
    updateKBVariables?: (updates: any) => Promise<void>;
    kbVariables?: any;
    // Automatic mode controls
    automaticMode?: boolean;
    onAutoStartCoding?: () => void;
    recordingEnabled?: boolean;
    initialContextUpdates?: string[];
}

/**
 * RealTimeConversation
 * - Manages the ElevenLabs realtime session lifecycle, mic state, and message flow.
 * - Forwards transcripts and KB updates; supports auto-start-coding triggers.
 */
const RealTimeConversation = forwardRef<any, RealTimeConversationProps>(
    (
        {
            onStartConversation,
            onEndConversation,
            onInterviewConcluded,
            isInterviewActive = false,
            candidateName = "Candidate",
            roles = { interviewer: "elevenLabs", candidate: "human" },
            handleUserTranscript,
            updateKBVariables,
            kbVariables,
            automaticMode = false,
            onAutoStartCoding,
            recordingEnabled = false,
            initialContextUpdates = [],
        },
        ref
    ) => {
        const [isConnected, setIsConnected] = useState(false);
        const [isRecording, setIsRecording] = useState(false);
        const [connectionStatus, setConnectionStatus] =
            useState("Disconnected");
        const [micMuted, setMicMuted] = useState(false);
        const [lastAiResponse, setLastAiResponse] = useState<string>("");
        const [isClosingMessagePlaying, setIsClosingMessagePlaying] =
            useState(false);
        const { state, clearContextUpdates, clearUserMessages } =
            useInterview();
        const hasAutoStartedRef = useRef<boolean>(false);
        const autoStartPendingRef = useRef<boolean>(false);
        const webSpeechRef = useRef<any>(null);
        const webSpeechShouldRunRef = useRef<boolean>(false);
        const initialPromptSentRef = useRef<boolean>(false);

        // Role behavior strategy (keeps component transport-only)
        const roleBehavior = useConversationRoleBehavior(roles, automaticMode);

        // State machine functions are now passed as props from parent

        // Interviewer-only adapter: always use ElevenLabs transport

        // ElevenLabs conversation binding and event handlers via MicSession
        const { conversation } = useMicSession({
            micMuted,
            onConnect: async () => {
                log.info("✅ Connected to Eleven Labs");
                setIsConnected(true);
                setConnectionStatus("Connected");

                // Log client-tool API availability on connect
                const anyConv: any = conversation as any;
                log.info("Client-tool API availability on connect", {
                    status: conversation.status,
                    hasSet: typeof anyConv?.setClientTools === "function",
                    hasRegister:
                        typeof anyConv?.registerClientTool === "function",
                    hasAdd: typeof anyConv?.addClientTool === "function",
                });

                // Prime KB variables immediately on connect (ElevenLabs only)
                updateKBVariables?.({
                    candidate_name: candidateName,
                    is_coding: false,
                    has_submitted: false,
                    current_code_summary: state.currentCode ?? "",
                });

                // Disabled: initial contextual update (prompt) send on connect
                // try {
                //     const first =
                //         Array.isArray(initialContextUpdates) &&
                //         initialContextUpdates.length > 0
                //             ? initialContextUpdates[0]
                //             : "";
                //     if (
                //         !initialPromptSentRef.current &&
                //         first &&
                //         (conversation as any)?.sendContextualUpdate
                //     ) {
                //         log.info(
                //             "📤 Initial interviewer prompt (contextual update):",
                //             first
                //         );
                //         await (conversation as any).sendContextualUpdate(first);
                //         initialPromptSentRef.current = true;
                //         log.info(
                //             "✅ Sent initial interviewer prompt via contextual update"
                //         );
                //     }
                // } catch (_) {}

                // Notify ChatPanel about recording status
                window.parent.postMessage(
                    {
                        type: "recording-status",
                        isRecording: true,
                    },
                    "*"
                );

                onStartConversation?.();
            },
            onDisconnect: (event) => {
                log.info("❌ Disconnected from Eleven Labs:", event);
                setIsConnected(false);
                setConnectionStatus("Disconnected");

                // Notify ChatPanel about recording status
                window.parent.postMessage(
                    {
                        type: "recording-status",
                        isRecording: false,
                    },
                    "*"
                );

                onEndConversation?.();
            },
            onMessage: async (message) => {
                log.info("📨 Message:", message);

                // Send transcription data to ChatPanel
                if (message.message) {
                    const isAiMessage = message.source !== "user";
                    let messageText = message.message;

                    // Client tools are now registered on the session; no interception here

                    // Track AI responses for automatic interview ending
                    if (isAiMessage) setLastAiResponse(messageText);

                    // Role-driven auto-start trigger
                    if (
                        !hasAutoStartedRef.current &&
                        roleBehavior.shouldAutoStartFromMessage({
                            text: messageText,
                            source: isAiMessage ? "ai" : "user",
                        })
                    ) {
                        autoStartPendingRef.current = true;
                        log.info(
                            "🎯 Trigger phrase detected; will auto-start after current speaker finishes"
                        );
                    }

                    // Role-driven closing-line detection (interviewer=ElevenLabs only)
                    if (roleBehavior.isClosingLine(messageText)) {
                        log.info(
                            "🎯 Detected closing message - preparing to end interview"
                        );
                        setIsClosingMessagePlaying(true);
                    }

                    if (!isAiMessage) {
                        // Handle user transcripts through state machine
                        if (handleUserTranscript) {
                            await handleUserTranscript(messageText);
                        }
                    }

                    // Always forward user transcripts
                    window.parent.postMessage(
                        {
                            type: "transcription",
                            text: messageText,
                            speaker: isAiMessage ? "ai" : "user",
                            timestamp: new Date(),
                        },
                        "*"
                    );
                    try {
                        if (sessionIdRef.current) {
                            const interviewerId =
                                (window as any)?.__interviewerId ||
                                "interviewer";
                            const candidateId =
                                (window as any)?.__candidateId || "candidate";
                            void appendTranscriptLine(
                                sessionIdRef.current,
                                isAiMessage ? "candidate" : "interviewer",
                                isAiMessage ? candidateId : interviewerId,
                                messageText
                            );
                        }
                    } catch (_) {}
                }
            },
            onError: (error: any) => {
                log.error("🚨 Interviewer: Eleven Labs error:", error);
                log.error("🚨 Interviewer: Error type:", typeof error);
                log.error(
                    "🚨 Interviewer: Error properties:",
                    Object.keys(error)
                );

                // Handle WebSocket CloseEvent specifically
                if (error && typeof error === "object" && "code" in error) {
                    log.error(
                        "🚨 Interviewer: WebSocket Close Code:",
                        error.code
                    );
                    log.error(
                        "🚨 Interviewer: WebSocket Reason:",
                        error.reason
                    );
                    setConnectionStatus(
                        `WebSocket closed: ${error.reason} (Code: ${error.code})`
                    );
                } else {
                    setConnectionStatus("Connection Error");
                }
            },
        });

        // Transport adapter (ElevenLabs/OpenAI)
        const adapter = useElevenLabsTransport({ conversation });

        /**
         * Fetches a signed URL for ElevenLabs session initialization.
         */
        const getSignedUrl = useCallback(async (): Promise<string> => {
            log.info("🔗 Interviewer: Fetching signed URL...");
            const roleQuery =
                roles.candidate === "elevenLabs" ? "candidate" : "interviewer";
            const response = await fetch(`/api/convai?role=${roleQuery}`);
            log.info("🔗 Interviewer: Response status:", response.status);

            if (!response.ok) {
                const errorText = await response.text();
                log.error("🔗 Interviewer: Error response:", errorText);
                throw new Error(
                    `Failed to get signed url: ${response.statusText} - ${errorText}`
                );
            }

            const data = await response.json();
            log.info("🔗 Interviewer: Response data:", data);
            log.info("🔗 Interviewer: Signed URL:", data.signedUrl);

            if (!data.signedUrl) {
                throw new Error("No signedUrl in response");
            }

            return data.signedUrl;
        }, []);

        // KB update refs
        const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
        const lastSentCodeRef = useRef<string>("");
        const micStreamRef = useRef<MediaStream | null>(null);
        const hasSubmittedRef = useRef<boolean>(false);
        const concludedRef = useRef<boolean>(false);
        const pendingClientToolsRef = useRef<any | null>(null);
        const mediaRecorderRef = useRef<MediaRecorder | null>(null);
        const audioChunkIndexRef = useRef<number>(0);
        const sessionIdRef = useRef<string | null>(null);

        /**
         * Requests mic permissions and flips the recording flag to begin connect flow.
         */
        const startConversation = useCallback(async () => {
            try {
                log.info("🎤 Interviewer: Requesting audio permissions...");
                const micStream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
                micStreamRef.current = micStream;
                log.info("✅ Interviewer: Audio permissions granted");
                setIsRecording(true);
                log.info("✅ Interviewer: Audio setup complete");
                // Recording will be managed reactively by the toggle below
                if (recordingEnabled) {
                    // Defer actual start to reactive effect
                }
                await adapter.start();
            } catch (error) {
                log.error("❌ Failed to start audio or conversation:", error);
                setConnectionStatus("Failed to start");
            }
        }, [adapter, recordingEnabled]);

        /**
         * Starts the ElevenLabs realtime session using the signed URL.
         */
        const connectToElevenLabs = useCallback(async () => {
            try {
                log.info("Getting signed URL...");
                const signedUrl = await getSignedUrl();
                log.info("Got signed URL:", signedUrl);
                log.info("🎯 Interviewer: Starting ElevenLabs session...");

                // Transport-only: start session with signed URL; include client tools if provided via proxy prior to start
                const startArgs: any = { signedUrl };
                if (pendingClientToolsRef.current) {
                    startArgs.clientTools = pendingClientToolsRef.current;
                    log.info("Including client tools in startSession", {
                        toolNames: Object.keys(pendingClientToolsRef.current),
                    });
                }
                await conversation.startSession(startArgs);
                log.info("Session started successfully");
            } catch (error) {
                log.error("Failed to start conversation session:", error);
                if (error instanceof Error) {
                    log.error("Error details:", {
                        message: error.message,
                        name: error.name,
                        stack: error.stack,
                    });
                }
                setConnectionStatus("Connection failed");
            }
        }, [getSignedUrl, conversation]);

        /**
         * When recording turns on, connect to ElevenLabs; otherwise do nothing.
         */
        useEffect(() => {
            if (isRecording) {
                log.info("🔄 isRecording is true, connecting to ElevenLabs...");
                connectToElevenLabs();
            } else {
                log.info("⏸️ isRecording is false, not connecting");
            }
        }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

        // Throttled code-summary KB updates while connected and before submission.
        useKBUpdates({
            conversation,
            kbVariables,
            currentCode: state.currentCode,
            updateKBVariables,
        });

        // Flush queued context updates and user messages when connected
        useFlushQueues({
            conversation,
            contextUpdates: state.contextUpdatesQueue || [],
            userMessages: state.userMessagesQueue || [],
            clearContextUpdates,
            clearUserMessages,
        });

        /**
         * Gracefully ends session: clears timers, stops mic, closes session, updates UI.
         */
        const disconnectFromConversation = useCallback(() => {
            log.info("🔌 Disconnecting from conversation...");

            // Clear any pending KB_UPDATE timeout
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
                updateTimeoutRef.current = null;
            }

            // Stop microphone stream tracks
            if (micStreamRef.current) {
                log.info("🎤 Stopping microphone tracks...");
                micStreamRef.current.getTracks().forEach((track) => {
                    log.info(
                        `🛑 Stopping microphone track: ${track.kind} - ${track.label}`
                    );
                    track.stop();
                });
                micStreamRef.current = null;
                log.info("✅ Microphone tracks stopped");
            }
            // Stop recorder and end recording session if active
            if (mediaRecorderRef.current) {
                try {
                    mediaRecorderRef.current.stop();
                } catch (_) {}
                mediaRecorderRef.current = null;
            }
            if (sessionIdRef.current) {
                try {
                    void endRecordingSession(sessionIdRef.current);
                } catch (_) {}
                sessionIdRef.current = null;
            }

            log.info("🔚 Ending session");
            if (webSpeechRef.current) {
                try {
                    webSpeechShouldRunRef.current = false;
                    webSpeechRef.current.stop?.();
                } catch (_) {}
                webSpeechRef.current = null;
            }
            try {
                conversation.endSession();
            } catch (_) {}
            setIsRecording(false);
            setIsConnected(false);
            setConnectionStatus("Disconnected");
            onEndConversation?.();
            log.info("✅ Disconnection complete");
            adapter.stop();
        }, [conversation, onEndConversation, adapter]);

        /**
         * Public wrapper to end the session.
         */
        const stopConversation = useCallback(async () => {
            log.info("🛑 Stop conversation called");
            disconnectFromConversation();
        }, [disconnectFromConversation]);

        // React to recording toggle without interrupting conversation flow
        useEffect(() => {
            (async () => {
                try {
                    // Start recording when enabled and not already recording
                    if (recordingEnabled && micStreamRef.current) {
                        if (!sessionIdRef.current) {
                            const iso = new Date()
                                .toISOString()
                                .replace(/[:.]/g, "-");
                            const sessionId = `session_${iso}`;
                            sessionIdRef.current = sessionId;
                            // Derive path parts from URL (company/role/candidate slug)
                            let companyParam: string | null = null;
                            let roleParam: string | null = null;
                            let candidateSlug: string | null = null;
                            try {
                                const url = new URL(window.location.href);
                                companyParam = url.searchParams.get("company");
                                roleParam = url.searchParams.get("role");
                                candidateSlug =
                                    url.searchParams.get("candidateId") ||
                                    url.searchParams.get("candidate");
                            } catch (_) {}

                            await startRecordingSession({
                                session_id: sessionId,
                                metadata: {
                                    session_id: sessionId,
                                    purpose: "train_interviewer_digital_twin",
                                    interviewer: {
                                        id: "noam",
                                        role: "human",
                                        audio_recorded: true,
                                    },
                                    candidate_info: {
                                        id: "larry_sim",
                                        role: "ai",
                                    },
                                    task: { id: "unknown", brief: "" },
                                    environment: {
                                        editor: "monaco",
                                        language: "typescript",
                                        framework: "react",
                                        tools_enabled: [
                                            "open_file",
                                            "write_file",
                                        ],
                                    },
                                    timestamps: {
                                        started_at: new Date().toISOString(),
                                        ended_at: null,
                                    },
                                    notes: "toggle-start",
                                    company: companyParam || undefined,
                                    role: roleParam || undefined,
                                    candidate: candidateSlug || undefined,
                                },
                            });
                            const mr = new MediaRecorder(micStreamRef.current, {
                                mimeType: "audio/webm",
                            });
                            mediaRecorderRef.current = mr;
                            audioChunkIndexRef.current = 0;
                            mr.ondataavailable = async (e: BlobEvent) => {
                                if (!e.data || e.data.size === 0) return;
                                try {
                                    await sendAudioChunk(
                                        sessionId,
                                        e.data,
                                        audioChunkIndexRef.current++
                                    );
                                } catch (_) {}
                            };
                            mr.start(1000);
                            // Emit initial baseline snapshot if code exists
                            try {
                                const currentCode = state.currentCode || "";
                                const sid = sessionIdRef.current;
                                if (currentCode && sid) {
                                    await appendCodeSnapshot(sid, currentCode, {
                                        initial: true,
                                        tag: "baseline_at_session_start",
                                    });
                                }
                            } catch (_) {}
                        }
                    }
                    // Stop recording when disabled
                    if (!recordingEnabled) {
                        if (mediaRecorderRef.current) {
                            try {
                                mediaRecorderRef.current.stop();
                            } catch (_) {}
                            mediaRecorderRef.current = null;
                        }
                        if (sessionIdRef.current) {
                            try {
                                await endRecordingSession(sessionIdRef.current);
                            } catch (_) {}
                            sessionIdRef.current = null;
                        }
                    }
                } catch (_) {}
            })();
        }, [recordingEnabled, state.currentCode]);

        // Toggle mic mute function
        /**
         * Toggles microphone mute state and notifies parent via postMessage.
         */
        const toggleMicMute = useCallback(() => {
            setMicMuted((prev) => {
                const newValue = !prev;
                // Notify parent component about mic state change
                window.parent.postMessage(
                    {
                        type: "mic-state-changed",
                        micMuted: newValue,
                    },
                    "*"
                );
                return newValue;
            });
        }, []);

        // Minimal test function - exactly as requested

        // Send user message method
        /**
         * Sends a user message through the realtime session if connected.
         */
        const sendUserMessage = useCallback(
            async (message: string) => {
                try {
                    const ok = await adapter.sendUserMessage(message);
                    logger.info("✅ User message sent via adapter:", message);
                    return ok;
                } catch (error) {
                    logger.error("❌ Failed to send user message:", error);
                    return false;
                }
            },
            [adapter]
        );

        // Expose methods to parent component
        // Expose imperative API to parent
        useImperativeHandle(ref, () => ({
            startConversation,
            stopConversation,
            sendContextualUpdate: conversation.sendContextualUpdate,
            sendUserMessage,
            micMuted,
            toggleMicMute,
            // Expose minimal tool registration proxies for external wiring
            setClientTools: (tools: any) => {
                const anyConv: any = conversation as any;
                log.info("RTC.setClientTools invoked", {
                    hasSet: typeof anyConv?.setClientTools === "function",
                    toolNames: Object.keys(tools || {}),
                    status: conversation.status,
                });
                // Always cache tools for startSession fallback
                pendingClientToolsRef.current = tools;
                if (typeof anyConv.setClientTools === "function") {
                    anyConv.setClientTools(tools);
                }
            },
            registerClientTool: (name: string, handler: any) => {
                const anyConv: any = conversation as any;
                log.info("RTC.registerClientTool invoked", {
                    hasRegister:
                        typeof anyConv?.registerClientTool === "function",
                    name,
                    status: conversation.status,
                });
                if (typeof anyConv.registerClientTool === "function") {
                    anyConv.registerClientTool(name, handler);
                }
            },
            addClientTool: (name: string, handler: any) => {
                const anyConv: any = conversation as any;
                log.info("RTC.addClientTool invoked", {
                    hasAdd: typeof anyConv?.addClientTool === "function",
                    name,
                    status: conversation.status,
                });
                if (typeof anyConv.addClientTool === "function") {
                    anyConv.addClientTool(name, handler);
                }
            },
        }));

        // Monitor AI speaking state to detect when closing message audio ends
        /**
         * Tracks speaking state for two flows:
         * 1) End interview after closing message finishes.
         * 2) Auto-start coding after trigger text once speaker finishes (automatic mode).
         */
        useEffect(() => {
            if (isClosingMessagePlaying && !conversation.isSpeaking) {
                log.info(
                    "🎯 Closing message audio finished - triggering interview end"
                );
                setIsClosingMessagePlaying(false);

                // Wait a short moment then stop the interview
                setTimeout(() => {
                    log.info("⏰ 1 second delay complete - stopping interview");
                    if (!concludedRef.current) {
                        concludedRef.current = true;
                        log.info(
                            "🎉 AUTOMATIC INTERVIEW END: Interview ended automatically after closing message"
                        );
                        // Notify parent that interview has concluded automatically (once)
                        onInterviewConcluded?.();
                        stopConversation();
                    } else {
                        log.info(
                            "⏭️ Closing already processed; skipping duplicate end"
                        );
                    }
                }, 250);
            }
            // After trigger message finishes speaking, auto start coding (automatic mode)
            if (
                automaticMode &&
                autoStartPendingRef.current &&
                !conversation.isSpeaking &&
                !hasAutoStartedRef.current
            ) {
                try {
                    log.info(
                        "🚀 Auto-starting coding now (agent finished speaking)"
                    );
                    onAutoStartCoding?.();
                } catch (_) {}
                hasAutoStartedRef.current = true;
                autoStartPendingRef.current = false;
            }
        }, [
            conversation.isSpeaking,
            isClosingMessagePlaying,
            stopConversation,
            onInterviewConcluded,
            automaticMode,
            onAutoStartCoding,
        ]);

        // Cleanup on unmount
        /**
         * Cleanup on unmount: stop mic and close session.
         */
        useEffect(() => {
            return () => {
                // Stop microphone stream tracks on unmount
                if (micStreamRef.current) {
                    log.info("🔄 Unmounting: Stopping microphone tracks...");
                    micStreamRef.current.getTracks().forEach((track) => {
                        log.info(
                            `🛑 Stopping microphone track on unmount: ${track.kind} - ${track.label}`
                        );
                        track.stop();
                    });
                    micStreamRef.current = null;
                }
                if (mediaRecorderRef.current) {
                    try {
                        mediaRecorderRef.current.stop();
                    } catch (_) {}
                    mediaRecorderRef.current = null;
                }
                if (webSpeechRef.current) {
                    try {
                        webSpeechShouldRunRef.current = false;
                        webSpeechRef.current.stop?.();
                    } catch (_) {}
                    webSpeechRef.current = null;
                }
                hasSubmittedRef.current = false;
                concludedRef.current = false;
                disconnectFromConversation();
            };
        }, []); // eslint-disable-line react-hooks/exhaustive-deps

        return (
            <div className="w-full max-w-4xl mx-auto">
                <div className="text-center text-gray-400">
                    {/* Animated waveform indicator */}
                    <AnimatedWaveform
                        isSpeaking={conversation.isSpeaking}
                        isInterviewActive={isInterviewActive}
                    />

                    <p>
                        {conversation.status === "connected" &&
                            (conversation.isSpeaking
                                ? "Speaking..."
                                : "Listening...")}
                    </p>
                    {/* Status text moved to RightPanel header */}
                </div>
            </div>
        );
    }
);

RealTimeConversation.displayName = "RealTimeConversation";

export default RealTimeConversation;
