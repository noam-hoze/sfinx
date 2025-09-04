"use client";

import React, {
    useEffect,
    useState,
    useCallback,
    forwardRef,
    useImperativeHandle,
    useRef,
} from "react";
// import { useConversation } from "@elevenlabs/react"; // Temporarily commented out
import StreamingAvatar, {
    TaskType,
    AvatarQuality,
} from "@heygen/streaming-avatar";
import HeyGenInterview, { HeyGenInterviewRef } from "./HeyGenInterview";

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

        // HeyGen references
        const heyGenRef = useRef<HeyGenInterviewRef>(null);
        const [heyGenStatus, setHeyGenStatus] = useState("Initializing...");

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
                console.log("🎤 Interviewer: Starting HeyGen interview...");

                // Request audio permissions for HeyGen
                await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
                console.log("✅ Interviewer: Audio permissions granted");

                // Start HeyGen interview
                await heyGenRef.current?.startInterview();
                console.log("✅ Interviewer: HeyGen interview started");

                // Speak the greeting
                await heyGenRef.current?.speakText(
                    "Hi Noam, how are you today? Are you feeling well or what?"
                );

                setIsRecording(true);
                setIsConnected(true);
                setConnectionStatus("Connected - HeyGen Active");
                setHeyGenStatus("Speaking greeting...");

                // Notify ChatPanel about recording status
                window.parent.postMessage(
                    {
                        type: "recording-status",
                        isRecording: true,
                    },
                    "*"
                );

                onStartConversation?.();
            } catch (error) {
                console.error("❌ Failed to start HeyGen interview:", error);
                setConnectionStatus("Failed to start HeyGen");
                setHeyGenStatus("Connection failed");
            }
        }, [onStartConversation]);

        // HeyGen connection is handled in startConversation method

        // HeyGen initialization happens in the startConversation method
        // No need for automatic connection on isRecording change

        const disconnectFromConversation = useCallback(() => {
            console.log("🔌 Disconnecting from conversation...");

            console.log("🔚 Ending HeyGen session");
            conversation.endSession();
            setIsRecording(false);
            setIsConnected(false);
            setConnectionStatus("Disconnected");
            onEndConversation?.();
            console.log("✅ Disconnection complete");
        }, [conversation, onEndConversation]);

        const stopConversation = useCallback(async () => {
            console.log("🛑 Stop conversation called");

            try {
                setHeyGenStatus("Stopping interview...");
                setConnectionStatus("Disconnecting...");

                await heyGenRef.current?.stopInterview();
                console.log("✅ HeyGen interview stopped");

                setHeyGenStatus("Interview stopped");
                setConnectionStatus("Disconnected");
            } catch (error) {
                console.error("❌ Error stopping HeyGen interview:", error);
                setHeyGenStatus("Stop failed");
                setConnectionStatus("Disconnect failed");
            }

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
            <div className="w-full max-w-4xl mx-auto space-y-4">
                {/* HeyGen Interview Component - Video and Avatar */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <HeyGenInterview
                        ref={heyGenRef}
                        onVideoReady={() => {
                            console.log("🎥 HeyGen video is ready");
                            setHeyGenStatus("Video ready");
                        }}
                        onSpeakingStart={() => {
                            console.log("🎤 HeyGen avatar started speaking");
                            setHeyGenStatus("Speaking...");
                        }}
                        onSpeakingEnd={() => {
                            console.log("🔇 HeyGen avatar finished speaking");
                            setHeyGenStatus("Listening...");
                        }}
                    />
                </div>

                {/* Status Display */}
                <div className="text-center text-gray-400 space-y-2">
                    <div>
                        <p className="text-sm">
                            <span className="font-medium">HeyGen Status:</span>{" "}
                            <span
                                className={`font-semibold ${
                                    connectionStatus.includes("Connected")
                                        ? "text-green-400"
                                        : connectionStatus.includes("Failed")
                                        ? "text-red-400"
                                        : "text-yellow-400"
                                }`}
                            >
                                {heyGenStatus}
                            </span>
                        </p>
                    </div>
                    <div>
                        <p className="text-sm">
                            <span className="font-medium">Connection:</span>{" "}
                            <span className="font-semibold text-gray-400">
                                {connectionStatus}
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        );
    }
);

RealTimeConversation.displayName = "RealTimeConversation";

export default RealTimeConversation;
