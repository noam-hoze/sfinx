"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";

interface RealTimeConversationProps {
    onStartConversation?: () => void;
    onEndConversation?: () => void;
}

const RealTimeConversation: React.FC<RealTimeConversationProps> = ({
    onStartConversation,
    onEndConversation,
}) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState("Disconnected");
    const [isCoding, setIsCoding] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

    const conversation = useConversation({
        onConnect: () => {
            console.log("✅ Connected to Eleven Labs");
            setIsConnected(true);
            setConnectionStatus("Connected");
            onStartConversation?.();
        },
        onDisconnect: (event) => {
            console.log("❌ Disconnected from Eleven Labs:", event);
            setIsConnected(false);
            setConnectionStatus("Disconnected");
            onEndConversation?.();
        },
        onMessage: (message) => console.log("📨 Message:", message),
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

    const getSignedUrl = async (): Promise<string> => {
        console.log("🔗 Interviewer: Fetching signed URL...");
        const response = await fetch("/api/test-signed-url");
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
    };

    const startConversation = useCallback(async () => {
        try {
            console.log("🎤 Interviewer: Requesting media permissions...");
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
            });
            console.log("✅ Interviewer: Media permissions granted");

            // Simplified: Just get media, don't set up recording
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            // Skip MediaRecorder setup for now
            setIsRecording(true);
            console.log("✅ Interviewer: Media setup complete");
        } catch (error) {
            console.error("❌ Failed to start camera or conversation:", error);
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
    }, []);

    useEffect(() => {
        if (isRecording) {
            console.log("🔄 isRecording is true, connecting to ElevenLabs...");
            connectToElevenLabs();
        } else {
            console.log("⏸️ isRecording is false, not connecting");
        }
    }, [isRecording, connectToElevenLabs]);

    // Send contextual updates when coding state changes
    useEffect(() => {
        if (isConnected) {
            const contextualMessage = isCoding
                ? "The user has started coding and needs to focus. Do not interrupt."
                : "The user has stopped coding and is ready to talk.";
            conversation.sendContextualUpdate(contextualMessage);
        }
    }, [isCoding, isConnected]);

    const disconnectFromConversation = useCallback(() => {
        console.log("🔌 Disconnecting from conversation...");

        if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state === "recording"
        ) {
            console.log("🛑 Stopping media recorder");
            mediaRecorderRef.current.stop();
        }

        if (videoRef.current && videoRef.current.srcObject) {
            console.log("📹 Stopping video stream");
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach((track) => track.stop());
            videoRef.current.srcObject = null;
        }

        console.log("🔚 Ending ElevenLabs session");
        conversation.endSession();
        setIsConnected(false);
        setConnectionStatus("Disconnected");
        onEndConversation?.();
        console.log("✅ Disconnection complete");
    }, [conversation, onEndConversation]);

    const stopConversation = useCallback(async () => {
        console.log("🛑 Stop conversation called");
        disconnectFromConversation();
    }, [disconnectFromConversation]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnectFromConversation();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="relative aspect-video bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
                {/* User's Video Feed */}
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    className={`absolute right-0 bottom-0 w-1/4 h-auto bg-black rounded-lg border-2 border-gray-700 shadow-md transition-opacity duration-300 ${
                        isRecording ? "opacity-100" : "opacity-0"
                    }`}
                />
            </div>

            <div className="flex justify-center gap-4 mt-6">
                <button
                    onClick={startConversation}
                    disabled={isRecording}
                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50 transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
                >
                    Start Interview
                </button>
                <button
                    onClick={stopConversation}
                    disabled={!isRecording}
                    className="px-6 py-3 bg-red-600 text-white font-semibold rounded-full shadow-lg hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-400 focus:ring-opacity-50 transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
                >
                    Stop Interview
                </button>
                <button
                    onClick={() => setIsCoding(!isCoding)}
                    className={`px-6 py-3 font-semibold rounded-full shadow-lg transition-all duration-300 ${
                        isCoding
                            ? "bg-yellow-500 text-black"
                            : "bg-gray-700 text-white"
                    }`}
                >
                    {isCoding ? "Stop Coding" : "Start Coding"}
                </button>
            </div>

            <div className="text-center mt-4 text-gray-400">
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
};

export default RealTimeConversation;
