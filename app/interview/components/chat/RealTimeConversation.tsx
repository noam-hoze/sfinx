"use client";

import React, {
    useEffect,
    useState,
    useCallback,
    forwardRef,
    useImperativeHandle,
} from "react";
// import { useConversation } from "@elevenlabs/react"; // Temporarily commented out
import StreamingAvatar, {
    TaskType,
    AvatarQuality,
} from "@heygen/streaming-avatar";

interface RealTimeConversationProps {
    onStartConversation?: () => void;
    onEndConversation?: () => void;
}

const RealTimeConversation = forwardRef<any, RealTimeConversationProps>(
    ({ onStartConversation, onEndConversation }, ref) => {
        const [isConnected, setIsConnected] = useState(false);
        const [isRecording, setIsRecording] = useState(false);
        const [connectionStatus, setConnectionStatus] =
            useState("Disconnected");

        // Temporarily commented out ElevenLabs conversation
        // const conversation = useConversation({
        //     onConnect: () => {
        //         console.log("✅ Connected to Eleven Labs");
        //         setIsConnected(true);
        //         setConnectionStatus("Connected");
        //
        //         // Notify ChatPanel about recording status
        //         window.parent.postMessage(
        //             {
        //                 type: "recording-status",
        //                 isRecording: true,
        //             },
        //             "*"
        //         );
        //
        //         onStartConversation?.();
        //     },
        //     onDisconnect: (event) => {
        //         console.log("❌ Disconnected from Eleven Labs:", event);
        //         setIsConnected(false);
        //         setConnectionStatus("Disconnected");
        //
        //         // Notify ChatPanel about recording status
        //         window.parent.postMessage(
        //             {
        //                 type: "recording-status",
        //                 isRecording: false,
        //             },
        //             "*"
        //         );
        //
        //         onEndConversation?.();
        //     },
        //     onMessage: (message) => {
        //         console.log("📨 Message:", message);
        //
        //         // Send transcription data to ChatPanel
        //         if (message.message) {
        //             window.parent.postMessage(
        //                 {
        //                     type: "transcription",
        //                     text: message.message,
        //                     speaker: message.source === "user" ? "user" : "ai",
        //                     timestamp: new Date(),
        //                 },
        //                 "*"
        //             );
        //         }
        //     },
        //     onError: (error: any) => {
        //         console.error("🚨 Interviewer: Eleven Labs error:", error);
        //         console.error("🚨 Interviewer: Error type:", typeof error);
        //         console.error(
        //             "🚨 Interviewer: Error properties:",
        //             Object.keys(error)
        //         );
        //
        //         // Handle WebSocket CloseEvent specifically
        //         if (error && typeof error === "object" && "code" in error) {
        //             console.error(
        //                 "🚨 Interviewer: WebSocket Close Code:",
        //                 error.code
        //             );
        //             console.error(
        //                 "🚨 Interviewer: WebSocket Reason:",
        //                 error.reason
        //             );
        //             setConnectionStatus(
        //                 `WebSocket closed: ${error.reason} (Code: ${error.code})`
        //             );
        //         } else {
        //             setConnectionStatus("Connection Error");
        //         }
        //     },
        // });

        // Temporary placeholder for conversation
        const conversation = {
            status: "disconnected",
            isSpeaking: false,
            startSession: () => Promise.resolve(),
            endSession: () => {},
        };

        // Temporarily commented out ElevenLabs getSignedUrl
        // const getSignedUrl = useCallback(async (): Promise<string> => {
        //     console.log("🔗 Interviewer: Fetching signed URL...");
        //     const response = await fetch("/api/convai");
        //     console.log("🔗 Interviewer: Response status:", response.status);
        //
        //     if (!response.ok) {
        //         const errorText = await response.text();
        //         console.error("🔗 Interviewer: Error response:", errorText);
        //         throw new Error(
        //             `Failed to get signed url: ${response.statusText} - ${errorText}`
        //         );
        //     }
        //
        //     const data = await response.json();
        //     console.log("🔗 Interviewer: Response data:", data);
        //     console.log("🔗 Interviewer: Signed URL:", data.signedUrl);
        //
        //     if (!data.signedUrl) {
        //         throw new Error("No signedUrl in response");
        //     }
        //
        //     return data.signedUrl;
        // }, []);

        // Temporary placeholder
        const getSignedUrl = useCallback(async (): Promise<string> => {
            return "placeholder-url"; // This won't be used
        }, []);

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

        // Temporarily commented out ElevenLabs connectToElevenLabs
        // const connectToElevenLabs = useCallback(async () => {
        //     try {
        //         console.log("Getting signed URL...");
        //         const signedUrl = await getSignedUrl();
        //         console.log("Got signed URL:", signedUrl);
        //         console.log("🎯 Interviewer: Starting ElevenLabs session...");
        //
        //         // Remove delay to match test page
        //         await conversation.startSession({ signedUrl });
        //         console.log("Session started successfully");
        //     } catch (error) {
        //         console.error("Failed to start conversation session:", error);
        //         if (error instanceof Error) {
        //             console.error("Error details:", {
        //                 message: error.message,
        //                 name: error.name,
        //                 stack: error.stack,
        //             });
        //         }
        //         setConnectionStatus("Connection failed");
        //     }
        // }, [getSignedUrl]);

        // Temporary placeholder
        const connectToElevenLabs = useCallback(async () => {
            console.log("🎯 Interviewer: Starting HeyGen session (placeholder)...");
            setConnectionStatus("HeyGen session started");
        }, []);

        useEffect(() => {
            if (isRecording) {
                console.log(
                    "🔄 isRecording is true, connecting to ElevenLabs..."
                );
                connectToElevenLabs();
            } else {
                console.log("⏸️ isRecording is false, not connecting");
            }
        }, [isRecording]);

        const disconnectFromConversation = useCallback(() => {
            console.log("🔌 Disconnecting from conversation...");

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

        // Expose methods to parent component
        useImperativeHandle(ref, () => ({
            startConversation,
            stopConversation,
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
