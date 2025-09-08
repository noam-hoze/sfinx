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
import { useInterview } from "../../../../lib";
import AnimatedWaveform from "./AnimatedWaveform";
import { logger } from "../../../../lib";

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
        const { state } = useInterview();

        // State machine functions are now passed as props from parent

        const conversation = useConversation({
            micMuted,
            onConnect: () => {
                logger.info("✅ Connected to Eleven Labs");
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
                logger.info("❌ Disconnected from Eleven Labs:", event);
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
                console.log("📨 Message:", message);

                // Send transcription data to ChatPanel
                if (message.message) {
                    const isAiMessage = message.source !== "user";
                    let messageText = message.message;

                    if (isAiMessage) {
                        // Track AI responses for automatic interview ending
                        setLastAiResponse(messageText);

                        if (
                            messageText
                                .toLowerCase()
                                .includes(
                                    "the next steps will be shared with you shortly."
                                )
                        ) {
                            console.log(
                                "🎯 Detected closing message - preparing to end interview"
                            );
                            setIsClosingMessagePlaying(true);
                        } else {
                            console.log("❌ Closing message pattern not found");
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
                logger.error("🚨 Interviewer: Eleven Labs error:", error);
                logger.error("🚨 Interviewer: Error type:", typeof error);
                logger.error(
                    "🚨 Interviewer: Error properties:",
                    Object.keys(error)
                );

                // Handle WebSocket CloseEvent specifically
                if (error && typeof error === "object" && "code" in error) {
                    logger.error(
                        "🚨 Interviewer: WebSocket Close Code:",
                        error.code
                    );
                    logger.error(
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
            logger.info("🔗 Interviewer: Fetching signed URL...");
            const response = await fetch("/api/convai");
            logger.info("🔗 Interviewer: Response status:", response.status);

            if (!response.ok) {
                const errorText = await response.text();
                logger.error("🔗 Interviewer: Error response:", errorText);
                throw new Error(
                    `Failed to get signed url: ${response.statusText} - ${errorText}`
                );
            }

            const data = await response.json();
            logger.info("🔗 Interviewer: Response data:", data);
            logger.info("🔗 Interviewer: Signed URL:", data.signedUrl);

            if (!data.signedUrl) {
                throw new Error("No signedUrl in response");
            }

            return data.signedUrl;
        }, []);

        // KB update refs
        const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
        const lastSentCodeRef = useRef<string>("");
        const micStreamRef = useRef<MediaStream | null>(null);

        const startConversation = useCallback(async () => {
            try {
                logger.info("🎤 Interviewer: Requesting audio permissions...");
                const micStream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
                micStreamRef.current = micStream;
                logger.info("✅ Interviewer: Audio permissions granted");

                setIsRecording(true);
                logger.info("✅ Interviewer: Audio setup complete");
            } catch (error) {
                logger.error(
                    "❌ Failed to start audio or conversation:",
                    error
                );
                setConnectionStatus("Failed to start");
            }
        }, []);

        const connectToElevenLabs = useCallback(async () => {
            try {
                logger.info("Getting signed URL...");
                const signedUrl = await getSignedUrl();
                logger.info("Got signed URL:", signedUrl);
                logger.info("🎯 Interviewer: Starting ElevenLabs session...");

                // Remove delay to match test page
                await conversation.startSession({ signedUrl });
                logger.info("Session started successfully");
            } catch (error) {
                logger.error("Failed to start conversation session:", error);
                if (error instanceof Error) {
                    logger.error("Error details:", {
                        message: error.message,
                        name: error.name,
                        stack: error.stack,
                    });
                }
                setConnectionStatus("Connection failed");
            }
        }, [getSignedUrl, conversation]);

        useEffect(() => {
            if (isRecording) {
                logger.info(
                    "🔄 isRecording is true, connecting to ElevenLabs..."
                );
                connectToElevenLabs();
            } else {
                logger.info("⏸️ isRecording is false, not connecting");
            }
        }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

        // Auto KB_UPDATE on code changes (using state machine)
        useEffect(() => {
            if (conversation.status !== "connected") {
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
                    logger.info(
                        "✅ Code summary KB_UPDATE sent via state machine"
                    );
                } catch (error) {
                    logger.error("❌ Code summary KB_UPDATE failed:", error);
                }
            }, 1500);

            // Cleanup timeout on unmount
            return () => {
                if (updateTimeoutRef.current) {
                    clearTimeout(updateTimeoutRef.current);
                }
            };
        }, [state.currentCode, conversation.status]); // eslint-disable-line react-hooks/exhaustive-deps

        const disconnectFromConversation = useCallback(() => {
            logger.info("🔌 Disconnecting from conversation...");

            // Clear any pending KB_UPDATE timeout
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
                updateTimeoutRef.current = null;
            }

            // Stop microphone stream tracks
            if (micStreamRef.current) {
                logger.info("🎤 Stopping microphone tracks...");
                micStreamRef.current.getTracks().forEach((track) => {
                    logger.info(
                        `🛑 Stopping microphone track: ${track.kind} - ${track.label}`
                    );
                    track.stop();
                });
                micStreamRef.current = null;
                logger.info("✅ Microphone tracks stopped");
            }

            logger.info("🔚 Ending ElevenLabs session");
            conversation.endSession();
            setIsRecording(false);
            setIsConnected(false);
            setConnectionStatus("Disconnected");
            onEndConversation?.();
            logger.info("✅ Disconnection complete");
        }, [conversation, onEndConversation]);

        const stopConversation = useCallback(async () => {
            logger.info("🛑 Stop conversation called");
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
                        console.warn(
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
                logger.info(
                    "🎯 Closing message audio finished - triggering interview end"
                );
                setIsClosingMessagePlaying(false);

                // Wait 1 second then stop the interview
                setTimeout(() => {
                    logger.info(
                        "⏰ 1 second delay complete - stopping interview"
                    );
                    logger.info(
                        "🎉 AUTOMATIC INTERVIEW END: Interview ended automatically after closing message"
                    );
                    // Notify parent that interview has concluded automatically
                    onInterviewConcluded?.();
                    stopConversation();
                }, 1000);
            }
        }, [
            conversation.isSpeaking,
            isClosingMessagePlaying,
            stopConversation,
            onInterviewConcluded,
        ]);

        // Cleanup on unmount
        useEffect(() => {
            return () => {
                // Stop microphone stream tracks on unmount
                if (micStreamRef.current) {
                    logger.info("🔄 Unmounting: Stopping microphone tracks...");
                    micStreamRef.current.getTracks().forEach((track) => {
                        logger.info(
                            `🛑 Stopping microphone track on unmount: ${track.kind} - ${track.label}`
                        );
                        track.stop();
                    });
                    micStreamRef.current = null;
                }
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
                        Status:{" "}
                        <span className="font-semibold text-gray-400">
                            {conversation.status}
                        </span>
                    </p>
                    <p>
                        {conversation.status === "connected" &&
                            (conversation.isSpeaking
                                ? "Agent is speaking..."
                                : "Agent is listening...")}
                    </p>
                </div>
            </div>
        );
    }
);

RealTimeConversation.displayName = "RealTimeConversation";

export default RealTimeConversation;
