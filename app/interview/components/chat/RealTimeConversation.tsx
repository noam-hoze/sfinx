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

interface RealTimeConversationProps {
    onStartConversation?: () => void;
    onEndConversation?: () => void;
    isInterviewActive?: boolean;
}

const RealTimeConversation = forwardRef<any, RealTimeConversationProps>(
    (
        { onStartConversation, onEndConversation, isInterviewActive = false },
        ref
    ) => {
        const [isConnected, setIsConnected] = useState(false);
        const [isRecording, setIsRecording] = useState(false);
        const [connectionStatus, setConnectionStatus] =
            useState("Disconnected");
        const { state } = useInterview();

        const conversation = useConversation({
            onConnect: () => {
                console.log("✅ Connected to Eleven Labs");
                setIsConnected(true);
                setConnectionStatus("Connected");

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
                console.log("❌ Disconnected from Eleven Labs:", event);
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
            onMessage: (message) => {
                console.log("📨 Message:", message);

                // Send transcription data to ChatPanel
                if (message.message) {
                    window.parent.postMessage(
                        {
                            type: "transcription",
                            text: message.message,
                            speaker: message.source === "user" ? "user" : "ai",
                            timestamp: new Date(),
                        },
                        "*"
                    );
                }
            },
            onError: (error: any) => {
                console.error("🚨 Interviewer: Eleven Labs error:", error);
                console.error("🚨 Interviewer: Error type:", typeof error);
                console.error(
                    "🚨 Interviewer: Error properties:",
                    Object.keys(error)
                );

                // Handle WebSocket CloseEvent specifically
                if (error && typeof error === "object" && "code" in error) {
                    console.error(
                        "🚨 Interviewer: WebSocket Close Code:",
                        error.code
                    );
                    console.error(
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
            console.log("🔗 Interviewer: Fetching signed URL...");
            const response = await fetch("/api/convai");
            console.log("🔗 Interviewer: Response status:", response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error("🔗 Interviewer: Error response:", errorText);
                throw new Error(
                    `Failed to get signed url: ${response.statusText} - ${errorText}`
                );
            }

            const data = await response.json();
            console.log("🔗 Interviewer: Response data:", data);
            console.log("🔗 Interviewer: Signed URL:", data.signedUrl);

            if (!data.signedUrl) {
                throw new Error("No signedUrl in response");
            }

            return data.signedUrl;
        }, []);

        // KB update refs
        const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
        const lastSentCodeRef = useRef<string>("");

        const startConversation = useCallback(async () => {
            try {
                console.log("🎤 Interviewer: Requesting audio permissions...");
                await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
                console.log("✅ Interviewer: Audio permissions granted");

                setIsRecording(true);
                console.log("✅ Interviewer: Audio setup complete");
            } catch (error) {
                console.error(
                    "❌ Failed to start audio or conversation:",
                    error
                );
                setConnectionStatus("Failed to start");
            }
        }, []);

        const connectToElevenLabs = useCallback(async () => {
            try {
                console.log("Getting signed URL...");
                const signedUrl = await getSignedUrl();
                console.log("Got signed URL:", signedUrl);
                console.log("🎯 Interviewer: Starting ElevenLabs session...");

                // Remove delay to match test page
                await conversation.startSession({ signedUrl });
                console.log("Session started successfully");
            } catch (error) {
                console.error("Failed to start conversation session:", error);
                if (error instanceof Error) {
                    console.error("Error details:", {
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
                console.log(
                    "🔄 isRecording is true, connecting to ElevenLabs..."
                );
                connectToElevenLabs();
            } else {
                console.log("⏸️ isRecording is false, not connecting");
            }
        }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

        // Auto KB_UPDATE on code changes
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
                    const kb = { current_code_summary: state.currentCode };
                    const text = `KB_UPDATE: ${JSON.stringify(kb)}`;
                    await conversation.sendContextualUpdate(text);
                    lastSentCodeRef.current = state.currentCode;
                    console.log("✅ Auto KB_UPDATE sent");
                } catch (error) {
                    console.error("❌ Auto KB_UPDATE failed:", error);
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
            console.log("🔌 Disconnecting from conversation...");

            // Clear any pending KB_UPDATE timeout
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
                updateTimeoutRef.current = null;
            }

            console.log("🔚 Ending ElevenLabs session");
            conversation.endSession();
            setIsRecording(false);
            setIsConnected(false);
            setConnectionStatus("Disconnected");
            onEndConversation?.();
            console.log("✅ Disconnection complete");
        }, [conversation, onEndConversation]);

        const stopConversation = useCallback(async () => {
            console.log("🛑 Stop conversation called");
            disconnectFromConversation();
        }, [disconnectFromConversation]);

        // Minimal test function - exactly as requested
        const testSendMessage = async () => {
            try {
                if (conversation.status !== "connected") {
                    console.warn("⏳ Not connected yet; skipping KB update.");
                    return;
                }

                const kb = { current_code_summary: state.currentCode };
                const text = `KB_UPDATE: ${JSON.stringify(kb)}`;
                await conversation.sendContextualUpdate(text);
                console.log("✅ KB_UPDATE sent:", kb.current_code_summary);
            } catch (error) {
                console.error("❌ Error sending KB_UPDATE:", error);
            }
        };

        // Expose methods to parent component
        useImperativeHandle(ref, () => ({
            startConversation,
            stopConversation,
            sendContextualUpdate: conversation.sendContextualUpdate,
        }));

        // Cleanup on unmount
        useEffect(() => {
            return () => {
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
