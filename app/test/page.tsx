"use client";

import React, { useState, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";

export default function TestPage() {
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState("Disconnected");
    const [error, setError] = useState<string | null>(null);
    const [signedUrl, setSignedUrl] = useState<string | null>(null);

    const conversation = useConversation({
        onConnect: () => {
            console.log("✅ Connected to ElevenLabs");
            setIsConnected(true);
            setConnectionStatus("Connected");
            setError(null);
        },
        onDisconnect: (event) => {
            console.log("❌ Disconnected from ElevenLabs:", event);
            setIsConnected(false);
            setIsRecording(false);
            setConnectionStatus("Disconnected");
        },
        onMessage: (message) => {
            console.log("📨 Message:", message);
        },
        onError: (error: any) => {
            console.error("🚨 ElevenLabs error:", error);
            console.error("🚨 Error type:", typeof error);
            console.error("🚨 Error properties:", Object.keys(error));

            // Handle WebSocket CloseEvent specifically
            if (error && typeof error === "object" && "code" in error) {
                console.error("🚨 WebSocket Close Code:", error.code);
                console.error("🚨 WebSocket Reason:", error.reason);
                setError(
                    `WebSocket closed: ${error.reason} (Code: ${error.code})`
                );
            } else {
                setError(error?.message || "Unknown error occurred");
            }

            setConnectionStatus("Connection Error");
        },
    });

    const getSignedUrl = async (): Promise<string> => {
        console.log("🔗 Fetching signed URL from production endpoint...");

        const response = await fetch("/api/get-signed-url");
        console.log("🔗 Response status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("🔗 Error response:", errorText);
            throw new Error(
                `Failed to get signed url: ${response.statusText} - ${errorText}`
            );
        }

        const data = await response.json();
        console.log("🔗 Response data:", data);
        console.log("🔗 Signed URL:", data.signedUrl);

        if (!data.signedUrl) {
            throw new Error("No signedUrl in response");
        }

        setSignedUrl(data.signedUrl);
        return data.signedUrl;
    };

    const startConversation = useCallback(async () => {
        try {
            setError(null);
            setConnectionStatus("Requesting permissions...");

            // Request media permissions
            console.log("🎤 Requesting media permissions...");
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
            });
            console.log("✅ Media permissions granted");

            // Stop the stream immediately since ElevenLabs handles media
            stream.getTracks().forEach((track) => track.stop());

            setIsRecording(true);
            setConnectionStatus("Getting signed URL...");

            // Get signed URL and start session
            console.log("🎯 About to fetch signed URL...");
            const signedUrl = await getSignedUrl();
            console.log("🎯 Got signed URL, starting session...");
            console.log("🎯 Signed URL length:", signedUrl.length);
            console.log(
                "🎯 Signed URL starts with:",
                signedUrl.substring(0, 50) + "..."
            );

            console.log("🎯 Starting ElevenLabs session...");
            await conversation.startSession({ signedUrl });
            console.log("✅ Session started successfully");
            setConnectionStatus("Session Started");
        } catch (error) {
            console.error("❌ Failed to start conversation:", error);
            setConnectionStatus("Failed to start");
            setIsRecording(false);

            if (error instanceof Error) {
                setError(error.message);
            } else {
                setError("Unknown error occurred");
            }
        }
    }, [conversation]);

    const stopConversation = useCallback(async () => {
        try {
            setConnectionStatus("Stopping...");
            await conversation.endSession();
            setIsRecording(false);
            setConnectionStatus("Stopped");
        } catch (error) {
            console.error("❌ Failed to stop conversation:", error);
            setError("Failed to stop conversation");
        }
    }, [conversation]);

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold mb-8 text-center">
                    Conversational AI Test Page
                </h1>

                <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
                    {/* Status Display */}
                    <div className="text-center mb-6">
                        <h2 className="text-xl font-semibold mb-2">Status</h2>
                        <p
                            className={`text-lg font-medium ${
                                connectionStatus === "Connected"
                                    ? "text-green-400"
                                    : connectionStatus === "Connection Error" ||
                                      connectionStatus === "Failed to start"
                                    ? "text-red-400"
                                    : "text-yellow-400"
                            }`}
                        >
                            {connectionStatus}
                        </p>
                        {conversation.status && (
                            <p className="text-sm text-gray-400 mt-1">
                                ElevenLabs Status: {conversation.status}
                            </p>
                        )}
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-900 border border-red-600 rounded-lg p-4 mb-6">
                            <h3 className="text-red-400 font-semibold mb-2">
                                Error
                            </h3>
                            <p className="text-red-200">{error}</p>
                        </div>
                    )}

                    {/* Agent ID Input */}

                    {/* Control Buttons */}
                    <div className="flex justify-center gap-4 mb-6">
                        <button
                            onClick={async () => {
                                try {
                                    console.log(
                                        "🧪 Testing signed URL generation..."
                                    );
                                    const url = await getSignedUrl();
                                    console.log(
                                        "🧪 Signed URL test successful:",
                                        url.substring(0, 100) + "..."
                                    );
                                    alert(
                                        "Signed URL generated successfully! Check console for details."
                                    );
                                } catch (error) {
                                    console.error(
                                        "🧪 Signed URL test failed:",
                                        error
                                    );
                                    alert(
                                        "Signed URL test failed! Check console."
                                    );
                                }
                            }}
                            className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-lg hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-400 focus:ring-opacity-50 transition-all duration-300"
                        >
                            Test Signed URL
                        </button>

                        <button
                            onClick={startConversation}
                            disabled={isRecording}
                            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50 transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
                        >
                            {isRecording ? "Starting..." : "Start Conversation"}
                        </button>

                        <button
                            onClick={stopConversation}
                            disabled={!isRecording}
                            className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-lg hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-400 focus:ring-opacity-50 transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
                        >
                            Stop Conversation
                        </button>
                    </div>

                    {/* Connection Info */}
                    <div className="text-center text-gray-400">
                        <p className="text-sm">
                            {conversation.status === "connected" &&
                                (conversation.isSpeaking
                                    ? "🤖 Agent is speaking..."
                                    : "👂 Agent is listening...")}
                        </p>
                    </div>
                </div>

                {/* Debug Info */}
                <div className="mt-8 bg-gray-800 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-2">Debug Info</h3>
                    <div className="text-sm text-gray-400 space-y-1">
                        <p>Is Recording: {isRecording ? "Yes" : "No"}</p>
                        <p>Is Connected: {isConnected ? "Yes" : "No"}</p>
                        <p>
                            ElevenLabs Status:{" "}
                            {conversation.status || "Unknown"}
                        </p>
                        <p>
                            Agent Speaking:{" "}
                            {conversation.isSpeaking ? "Yes" : "No"}
                        </p>
                        <p>
                            Signed URL Length:{" "}
                            {signedUrl ? signedUrl.length : "N/A"}
                        </p>
                        {signedUrl && (
                            <p>Signed URL: {signedUrl.substring(0, 80)}...</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
