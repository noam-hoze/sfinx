"use client";

import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
    useCallback,
    forwardRef,
    useImperativeHandle,
} from "react";
import { useConversation } from "@elevenlabs/react";
import { useInterview } from "../../../../shared/contexts";
import AnimatedWaveform from "./AnimatedWaveform";
import { log } from "../../../../shared/services";
const logRef = log;

// Enable verbose logging for this module only
// (Removed dynamic runtime configuration; controlled centrally via config)

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
    // State machine functions passed from parent
    handleUserTranscript?: (transcript: string) => Promise<void>;
    updateKBVariables?: (updates: any) => Promise<void>;
    kbVariables?: any;
    // Automatic mode controls
    automaticMode?: boolean;
    onAutoStartCoding?: () => void;
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
            handleUserTranscript,
            updateKBVariables,
            kbVariables,
            automaticMode = false,
            onAutoStartCoding,
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

        // State machine functions are now passed as props from parent

        // ElevenLabs conversation binding and event handlers
        const conversation = useConversation({
            micMuted,
            onConnect: () => {
                logRef.info("✅ Connected to Eleven Labs");
                setIsConnected(true);
                setConnectionStatus("Connected");

                // Prime KB variables immediately on connect
                updateKBVariables?.({
                    candidate_name: candidateName,
                    is_coding: false,
                    has_submitted: false,
                    current_code_summary: state.currentCode ?? "",
                });

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
                logRef.info("❌ Disconnected from Eleven Labs:", event);
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
                logRef.info("📨 Message:", message);

                // Send transcription data to ChatPanel
                if (message.message) {
                    const isAiMessage = message.source !== "user";
                    let messageText = message.message;

                    if (isAiMessage) {
                        // Track AI responses for automatic interview ending
                        setLastAiResponse(messageText);

                        // Automatic start coding trigger
                        if (automaticMode && !hasAutoStartedRef.current) {
                            const normalized = messageText
                                .toLowerCase()
                                .replace(/[`'".,!?]/g, "")
                                .replace(/\s+/g, " ")
                                .trim();
                            const trigger =
                                "please build a react component called userlist";
                            if (normalized.includes(trigger)) {
                                autoStartPendingRef.current = true;
                                logRef.info(
                                    "🎯 Trigger phrase detected; will auto-start after agent finishes speaking"
                                );
                            }
                        }

                        if (
                            messageText
                                .toLowerCase()
                                .includes(
                                    "the next steps will be shared with you shortly."
                                )
                        ) {
                            logRef.info(
                                "🎯 Detected closing message - preparing to end interview"
                            );
                            setIsClosingMessagePlaying(true);
                        } else {
                            logRef.info("❌ Closing message pattern not found");
                        }
                    } else {
                        // Handle user transcripts through state machine
                        if (handleUserTranscript) {
                            await handleUserTranscript(messageText);
                        }
                    }

                    window.parent.postMessage(
                        {
                            type: "transcription",
                            text: messageText,
                            speaker: isAiMessage ? "ai" : "user",
                            timestamp: new Date(),
                        },
                        "*"
                    );
                }
            },
            onError: (error: any) => {
                logRef.error("🚨 Interviewer: Eleven Labs error:", error);
                logRef.error("🚨 Interviewer: Error type:", typeof error);
                logRef.error(
                    "🚨 Interviewer: Error properties:",
                    Object.keys(error)
                );

                // Handle WebSocket CloseEvent specifically
                if (error && typeof error === "object" && "code" in error) {
                    logRef.error(
                        "🚨 Interviewer: WebSocket Close Code:",
                        error.code
                    );
                    logRef.error(
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

        /**
         * Fetches a signed URL for ElevenLabs session initialization.
         */
        const getSignedUrl = useCallback(async (): Promise<string> => {
            logRef.info("🔗 Interviewer: Fetching signed URL...");
            const response = await fetch("/api/convai");
            logRef.info("🔗 Interviewer: Response status:", response.status);

            if (!response.ok) {
                const errorText = await response.text();
                logRef.error("🔗 Interviewer: Error response:", errorText);
                throw new Error(
                    `Failed to get signed url: ${response.statusText} - ${errorText}`
                );
            }

            const data = await response.json();
            logRef.info("🔗 Interviewer: Response data:", data);
            logRef.info("🔗 Interviewer: Signed URL:", data.signedUrl);

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

        /**
         * Requests mic permissions and flips the recording flag to begin connect flow.
         */
        const startConversation = useCallback(async () => {
            try {
                logRef.info("🎤 Interviewer: Requesting audio permissions...");
                const micStream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
                micStreamRef.current = micStream;
                logRef.info("✅ Interviewer: Audio permissions granted");

                setIsRecording(true);
                logRef.info("✅ Interviewer: Audio setup complete");
            } catch (error) {
                logRef.error("❌ Failed to start audio or conversation:", error);
                setConnectionStatus("Failed to start");
            }
        }, []);

        /**
         * Starts the ElevenLabs realtime session using the signed URL.
         */
        const connectToElevenLabs = useCallback(async () => {
            try {
                logRef.info("Getting signed URL...");
                const signedUrl = await getSignedUrl();
                logRef.info("Got signed URL:", signedUrl);
                logRef.info("🎯 Interviewer: Starting ElevenLabs session...");

                // Remove delay to match test page
                await conversation.startSession({ signedUrl });
                logRef.info("Session started successfully");
            } catch (error) {
                logRef.error("Failed to start conversation session:", error);
                if (error instanceof Error) {
                    logRef.error("Error details:", {
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
                logRef.info("isRecording is true, connecting to ElevenLabs...");
                connectToElevenLabs();
            } else {
                logRef.info("isRecording is false, not connecting");
            }
        }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

        // Auto KB_UPDATE on code changes (using state machine)
        /**
         * Throttled code-summary KB updates while connected and before submission.
         */
        useEffect(() => {
            if (conversation.status !== "connected") {
                return;
            }

            // Suppress code summary updates after submission
            if (hasSubmittedRef.current || kbVariables?.has_submitted) {
                return;
            }

            // Skip if code hasn't changed
            if (lastSentCodeRef.current === state.currentCode) {
                return;
            }

            // Clear previous timeout
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }

            // Set new timeout for throttled update
            updateTimeoutRef.current = setTimeout(async () => {
                try {
                    // Update through state machine to maintain consistency
                    await updateKBVariables?.({
                        current_code_summary: state.currentCode,
                    });
                    lastSentCodeRef.current = state.currentCode;
                    logRef.info(
                        "✅ Code summary KB_UPDATE sent via state machine"
                    );
                } catch (error) {
                    logRef.error("❌ Code summary KB_UPDATE failed:", error);
                }
            }, 1500);

            // Cleanup timeout on unmount
            return () => {
                if (updateTimeoutRef.current) {
                    clearTimeout(updateTimeoutRef.current);
                }
            };
        }, [state.currentCode, conversation.status]); // eslint-disable-line react-hooks/exhaustive-deps

        // Flush queued updates/messages from context when connected
        /**
         * Flushes queued context updates and user messages when a connection is live.
         */
        useEffect(() => {
            if (conversation.status !== "connected") return;

            // Flush contextual updates
            const updates = state.contextUpdatesQueue || [];
            if (updates.length > 0 && conversation.sendContextualUpdate) {
                (async () => {
                    for (const text of updates) {
                        try {
                            await conversation.sendContextualUpdate(text);
                            logRef.info("✅ Flushed contextual update:", text);
                        } catch (error) {
                            logRef.error("❌ Failed contextual update:", error);
                        }
                    }
                    clearContextUpdates();
                })();
            }

            // Flush user messages
            const messages = state.userMessagesQueue || [];
            if (messages.length > 0) {
                (async () => {
                    for (const msg of messages) {
                        try {
                            await conversation.sendUserMessage(msg);
                            logRef.info("✅ Flushed user message:", msg);
                        } catch (error) {
                            logRef.error("❌ Failed user message:", error);
                        }
                    }
                    clearUserMessages();
                })();
            }
        }, [
            conversation.status,
            state.contextUpdatesQueue,
            state.userMessagesQueue,
        ]);

        /**
         * Gracefully ends session: clears timers, stops mic, closes session, updates UI.
         */
        const disconnectFromConversation = useCallback(() => {
            logRef.info("🔌 Disconnecting from conversation...");

            // Clear any pending KB_UPDATE timeout
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
                updateTimeoutRef.current = null;
            }

            // Stop microphone stream tracks
            if (micStreamRef.current) {
                logRef.info("🎤 Stopping microphone tracks...");
                micStreamRef.current.getTracks().forEach((track) => {
                    logRef.info(
                        `🛑 Stopping microphone track: ${track.kind} - ${track.label}`
                    );
                    track.stop();
                });
                micStreamRef.current = null;
                logRef.info("✅ Microphone tracks stopped");
            }

            logRef.info("🔚 Ending ElevenLabs session");
            conversation.endSession();
            setIsRecording(false);
            setIsConnected(false);
            setConnectionStatus("Disconnected");
            onEndConversation?.();
            logRef.info("✅ Disconnection complete");
        }, [conversation, onEndConversation]);

        /**
         * Public wrapper to end the session.
         */
        const stopConversation = useCallback(async () => {
            logRef.info("🛑 Stop conversation called");
            disconnectFromConversation();
        }, [disconnectFromConversation]);

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
                    if (conversation.status !== "connected") {
                        logRef.warn(
                            "⏳ Conversation not connected, cannot send message"
                        );
                        return false;
                    }

                    await conversation.sendUserMessage(message);
                    logRef.info("✅ User message sent successfully:", message);
                    return true;
                } catch (error) {
                    logRef.error("❌ Failed to send user message:", error);
                    return false;
                }
            },
            [conversation]
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
        }));

        // Monitor AI speaking state to detect when closing message audio ends
        /**
         * Tracks speaking state for two flows:
         * 1) End interview after closing message finishes.
         * 2) Auto-start coding after trigger text once speaker finishes (automatic mode).
         */
        useEffect(() => {
            if (isClosingMessagePlaying && !conversation.isSpeaking) {
                logRef.info(
                    "🎯 Closing message audio finished - triggering interview end"
                );
                setIsClosingMessagePlaying(false);

                // Wait a short moment then stop the interview
                setTimeout(() => {
                    logRef.info("⏰ 1 second delay complete - stopping interview");
                    if (!concludedRef.current) {
                        concludedRef.current = true;
                        logRef.info(
                            "AUTOMATIC INTERVIEW END: Interview ended automatically after closing message"
                        );
                        // Notify parent that interview has concluded automatically (once)
                        onInterviewConcluded?.();
                        stopConversation();
                    } else {
                        logRef.info(
                            "Closing already processed; skipping duplicate end"
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
                    logRef.info(
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
        ]);

        // Cleanup on unmount
        /**
         * Cleanup on unmount: stop mic and close session.
         */
        useEffect(() => {
            return () => {
                // Stop microphone stream tracks on unmount
                if (micStreamRef.current) {
                    logRef.info("Unmounting: Stopping microphone tracks...");
                    micStreamRef.current.getTracks().forEach((track) => {
                        logRef.info(
                            `🛑 Stopping microphone track on unmount: ${track.kind} - ${track.label}`
                        );
                        track.stop();
                    });
                    micStreamRef.current = null;
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
