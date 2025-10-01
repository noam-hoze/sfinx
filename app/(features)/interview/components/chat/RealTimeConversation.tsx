"use client";

import React, {
    useEffect,
    useState,
    useCallback,
    forwardRef,
    useImperativeHandle,
    useRef,
} from "react";
import { useConversation } from "@elevenlabs/react";
import { useInterview } from "../../../../shared/contexts";
import AnimatedWaveform from "./AnimatedWaveform";
import { logger } from "../../../../shared/services";
const log = logger.for("@RealTimeConversation.tsx");

// Enable verbose logging for this module only
if (typeof window !== "undefined") {
    logger.setEnabled(true);
    logger.setNamespacedOnly(true);
    logger.setModules(["@RealTimeConversation.tsx"]);
    logger.setLevels(["debug", "info", "warn", "error"]);
}

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
    onCandidateTurn?: (message: string) => Promise<void> | void;
    candidateAgentId?: string;
    interviewSessionId?: string;
    trainingMode?: boolean;
    twinInterviewerMode?: boolean;
    // Automatic mode controls
    automaticMode?: boolean;
    onAutoStartCoding?: () => void;
}

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
            onCandidateTurn,
            candidateAgentId,
            interviewSessionId,
            trainingMode = false,
            twinInterviewerMode = false,
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
        const speechRecRef = useRef<any>(null);

        // State machine functions are now passed as props from parent

        const conversation = useConversation({
            micMuted,
            onConnect: () => {
                log.info("✅ Connected to Eleven Labs");
                setIsConnected(true);
                setConnectionStatus("Connected");

                // Prime KB variables immediately on connect (skip in training mode)
                if (!trainingMode) {
                    updateKBVariables?.({
                        candidate_name: candidateName,
                        is_coding: false,
                        has_submitted: false,
                        current_code_summary: state.currentCode ?? "",
                    });
                }

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
                                log.info(
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
                            log.info(
                                "🎯 Detected closing message - preparing to end interview"
                            );
                            setIsClosingMessagePlaying(true);
                        } else {
                            log.info("❌ Closing message pattern not found");
                        }
                    } else {
                        // Handle user transcripts through state machine
                        if (handleUserTranscript) {
                            await handleUserTranscript(messageText);
                        }
                        if (onCandidateTurn) {
                            try {
                                await onCandidateTurn(messageText);
                            } catch (error) {
                                log.error(
                                    "❌ Failed to handle candidate turn:",
                                    error
                                );
                            }
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

                    // Persist transcript turn to server
                    try {
                        if (interviewSessionId) {
                            await fetch("/api/interviews/session/transcript", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    interviewSessionId,
                                    turn: {
                                        role: trainingMode
                                            ? isAiMessage
                                                ? "candidate"
                                                : "interviewer"
                                            : isAiMessage
                                            ? "interviewer"
                                            : "candidate",
                                        text: messageText,
                                        ts: new Date().toISOString(),
                                    },
                                }),
                            });
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

        const getSignedUrl = useCallback(async (): Promise<string> => {
            log.info("🔗 Interviewer: Fetching signed URL...");
            // Normal flow uses interviewer agent; training uses candidate agent
            const params = new URLSearchParams();
            if (trainingMode && candidateAgentId) {
                params.set("agentId", candidateAgentId);
            }
            params.set("role", trainingMode ? "candidate" : "interviewer");
            const response = await fetch(`/api/convai?${params.toString()}`);
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
        }, [candidateAgentId, trainingMode]);

        // KB update refs
        const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
        const lastSentCodeRef = useRef<string>("");
        const micStreamRef = useRef<MediaStream | null>(null);
        const hasSubmittedRef = useRef<boolean>(false);
        const concludedRef = useRef<boolean>(false);

        const startConversation = useCallback(async () => {
            try {
                log.info("🎤 Interviewer: Requesting audio permissions...");
                const micStream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
                micStreamRef.current = micStream;
                log.info("✅ Interviewer: Audio permissions granted");

                if (twinInterviewerMode) {
                    // Start local STT via Web Speech API
                    try {
                        // @ts-ignore
                        const SpeechRecognition =
                            (window as any).SpeechRecognition ||
                            (window as any).webkitSpeechRecognition;
                        if (!SpeechRecognition) {
                            log.warn("Web Speech API not available");
                        } else {
                            const rec = new SpeechRecognition();
                            rec.continuous = true;
                            rec.interimResults = false;
                            rec.lang = "en-US";
                            rec.onresult = async (ev: any) => {
                                for (
                                    let i = ev.resultIndex;
                                    i < ev.results.length;
                                    i += 1
                                ) {
                                    const res = ev.results[i];
                                    if (res.isFinal) {
                                        const text = res[0].transcript.trim();
                                        if (!text) continue;
                                        // Post to chat as user
                                        window.parent.postMessage(
                                            {
                                                type: "transcription",
                                                text,
                                                speaker: "user",
                                                timestamp: new Date(),
                                            },
                                            "*"
                                        );
                                        // Forward to state machine and twin
                                        try {
                                            await handleUserTranscript?.(text);
                                        } catch (_) {}
                                        try {
                                            await onCandidateTurn?.(text);
                                        } catch (_) {}
                                        // Persist transcript
                                        if (interviewSessionId) {
                                            try {
                                                await fetch(
                                                    "/api/interviews/session/transcript",
                                                    {
                                                        method: "POST",
                                                        headers: {
                                                            "Content-Type":
                                                                "application/json",
                                                        },
                                                        body: JSON.stringify({
                                                            interviewSessionId,
                                                            turn: {
                                                                role: "candidate",
                                                                text,
                                                                ts: new Date().toISOString(),
                                                            },
                                                        }),
                                                    }
                                                );
                                            } catch (_) {}
                                        }
                                    }
                                }
                            };
                            rec.onerror = (e: any) =>
                                log.error("Speech error", e);
                            rec.onend = () =>
                                log.info("Speech recognition ended");
                            rec.start();
                            speechRecRef.current = rec;
                        }
                    } catch (err) {
                        log.error("Failed to start Web Speech API", err);
                    }
                } else {
                    setIsRecording(true);
                }

                log.info("✅ Interviewer: Audio setup complete");
            } catch (error) {
                log.error("❌ Failed to start audio or conversation:", error);
                setConnectionStatus("Failed to start");
            }
        }, []);

        const connectToElevenLabs = useCallback(async () => {
            try {
                log.info("Getting signed URL...");
                const signedUrl = await getSignedUrl();
                log.info("Got signed URL:", signedUrl);
                log.info("🎯 Interviewer: Starting ElevenLabs session...");

                // Remove delay to match test page
                await conversation.startSession({ signedUrl });
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

        useEffect(() => {
            if (twinInterviewerMode) {
                return; // Do not connect ConvAI in twin interviewer mode
            }
            if (isRecording) {
                log.info("🔄 isRecording is true, connecting to ElevenLabs...");
                connectToElevenLabs();
            } else {
                log.info("⏸️ isRecording is false, not connecting");
            }
        }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

        // Auto KB_UPDATE on code changes (using state machine) — disabled in training mode
        useEffect(() => {
            if (trainingMode) {
                return;
            }
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
                    log.info(
                        "✅ Code summary KB_UPDATE sent via state machine"
                    );
                } catch (error) {
                    log.error("❌ Code summary KB_UPDATE failed:", error);
                }
            }, 1500);

            // Cleanup timeout on unmount
            return () => {
                if (updateTimeoutRef.current) {
                    clearTimeout(updateTimeoutRef.current);
                }
            };
        }, [state.currentCode, conversation.status, trainingMode]); // eslint-disable-line react-hooks/exhaustive-deps

        // Flush queued updates/messages from context when connected
        useEffect(() => {
            if (conversation.status !== "connected") return;

            // Flush contextual updates (skip in training mode for clean slate)
            if (!trainingMode) {
                const updates = state.contextUpdatesQueue || [];
                if (updates.length > 0 && conversation.sendContextualUpdate) {
                    (async () => {
                        for (const text of updates) {
                            try {
                                await conversation.sendContextualUpdate(text);
                                log.info("✅ Flushed contextual update:", text);
                            } catch (error) {
                                log.error(
                                    "❌ Failed contextual update:",
                                    error
                                );
                            }
                        }
                        clearContextUpdates();
                    })();
                }
            }

            // Flush user messages
            const messages = state.userMessagesQueue || [];
            if (messages.length > 0) {
                (async () => {
                    for (const msg of messages) {
                        try {
                            await conversation.sendUserMessage(msg);
                            log.info("✅ Flushed user message:", msg);
                        } catch (error) {
                            log.error("❌ Failed user message:", error);
                        }
                    }
                    clearUserMessages();
                })();
            }
        }, [
            conversation.status,
            state.contextUpdatesQueue,
            state.userMessagesQueue,
            onCandidateTurn,
            trainingMode,
        ]);

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

            log.info("🔚 Ending ElevenLabs session");
            conversation.endSession();
            setIsRecording(false);
            setIsConnected(false);
            setConnectionStatus("Disconnected");
            onEndConversation?.();
            log.info("✅ Disconnection complete");
        }, [conversation, onEndConversation]);

        const stopConversation = useCallback(async () => {
            log.info("🛑 Stop conversation called");
            disconnectFromConversation();
        }, [disconnectFromConversation]);

        // Toggle mic mute function
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
        const sendUserMessage = useCallback(
            async (message: string) => {
                try {
                    if (conversation.status !== "connected") {
                        log.warn(
                            "⏳ Conversation not connected, cannot send message"
                        );
                        return false;
                    }

                    await conversation.sendUserMessage(message);
                    logger.info("✅ User message sent successfully:", message);
                    return true;
                } catch (error) {
                    logger.error("❌ Failed to send user message:", error);
                    return false;
                }
            },
            [conversation]
        );

        // Expose methods to parent component
        useImperativeHandle(ref, () => ({
            startConversation,
            stopConversation,
            sendContextualUpdate: conversation.sendContextualUpdate,
            sendUserMessage,
            micMuted,
            toggleMicMute,
        }));

        // Monitor AI speaking state to detect when closing message audio ends
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
        ]);

        // Cleanup on unmount
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
                // Stop local speech recognition if running
                try {
                    if (
                        speechRecRef.current &&
                        typeof speechRecRef.current.stop === "function"
                    ) {
                        speechRecRef.current.stop();
                    }
                } catch (_) {}
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
