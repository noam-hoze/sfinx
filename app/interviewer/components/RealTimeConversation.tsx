"use client";

import React, { useEffect, useRef, useState } from "react";
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

    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Float32Array[]>([]);

    const connectToConversation = async () => {
        // Prevent multiple connections
        if (isConnected || wsRef.current?.readyState === WebSocket.CONNECTING) {
            console.log("Already connecting or connected");
            return;
        }

        try {
            setConnectionStatus("Getting signed URL...");

            // Get signed WebSocket URL
            const response = await fetch("/api/convai");
            if (!response.ok) {
                throw new Error("Failed to get signed URL");
            }

            const data = await response.json();
            const wsUrl = data.url;

            if (!wsUrl) {
                throw new Error("No WebSocket URL received");
            }

            setConnectionStatus("Connecting...");

            // Connect to WebSocket
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("Connected to ElevenLabs conversation");
                setIsConnected(true);
                setConnectionStatus("Connected");
                onStartConversation?.();

                // Send text first to start conversation (no custom heartbeat needed)
                ws.send(
                    JSON.stringify({
                        type: "input_text",
                        text: "Hello! I'm ready for my coding interview. Please introduce yourself and let's get started.",
                    })
                );
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log("Received message:", message);

                    // Handle different message types
                    if (message.type === "conversation_initiation_metadata") {
                        console.log("Conversation started");
                    } else if (message.type === "audio") {
                        // Handle incoming audio
                        console.log("Received audio message:", message);
                        // Try different audio data structures
                        const audioData =
                            message.audio ||
                            message.audio_event?.audio_base_64 ||
                            message.audio_event?.audio ||
                            message.audio_base_64;
                        if (audioData) {
                            playAudio(audioData);
                        } else {
                            console.log("No audio data found in message");
                        }
                    } else if (message.type === "user_transcript") {
                        console.log(
                            "User said:",
                            message.user_transcript_event?.transcript ||
                                message.transcript ||
                                message.text
                        );
                    } else if (message.type === "agent_response") {
                        console.log(
                            "Agent response:",
                            message.agent_response_event
                        );
                        // Handle agent text response
                        if (message.agent_response_event?.agent_response) {
                            console.log(
                                "Agent said:",
                                message.agent_response_event.agent_response
                            );
                        } else if (message.agent_response) {
                            console.log("Agent said:", message.agent_response);
                        }
                    } else if (message.type === "ping") {
                        // Respond to ping to keep connection alive
                        console.log("Received ping, sending pong");
                        ws.send(JSON.stringify({ type: "pong" }));
                    } else if (message.type === "pong") {
                        console.log("Received pong");
                    } else {
                        console.log(
                            "Unknown message type:",
                            message.type,
                            message
                        );
                    }
                } catch (error) {
                    console.error(
                        "Error parsing WebSocket message:",
                        error,
                        "Raw data:",
                        event.data
                    );
                }
            };

            ws.onerror = (error) => {
                console.error("WebSocket error:", error);
                setConnectionStatus("Connection Error");
            };

            ws.onclose = (event) => {
                console.log("WebSocket closed", {
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean,
                });

                // Common WebSocket close codes:
                // 1000 - Normal closure
                // 1006 - Abnormal closure
                // 1008 - Policy violation
                // 1011 - Internal server error

                let statusMessage = "Disconnected";
                if (event.code === 1006) {
                    statusMessage = "Connection Lost (Abnormal)";
                } else if (event.code === 1008) {
                    statusMessage = "Connection Rejected (Policy)";
                } else if (event.code === 1011) {
                    statusMessage = "Server Error";
                } else if (event.code === 1000) {
                    statusMessage = "Connection Closed (Normal)";
                }

                console.log(
                    `Connection closed with code ${event.code}: ${statusMessage}`
                );

                setIsConnected(false);
                setConnectionStatus(statusMessage);
                onEndConversation?.();
            };
        } catch (error) {
            console.error("Failed to connect:", error);
            setConnectionStatus("Connection Failed");
        }
    };

    const disconnectFromConversation = () => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        stopRecording();
        setIsConnected(false);
        setConnectionStatus("Disconnected");
        onEndConversation?.();
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            audioContextRef.current = new AudioContext();

            const source =
                audioContextRef.current.createMediaStreamSource(stream);
            const processor = audioContextRef.current.createScriptProcessor(
                4096,
                1,
                1
            );

            processor.onaudioprocess = (event) => {
                const inputBuffer = event.inputBuffer;
                const inputData = inputBuffer.getChannelData(0);

                // Convert to 16-bit PCM
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    pcmData[i] = Math.max(
                        -32768,
                        Math.min(32767, inputData[i] * 32768)
                    );
                }

                // Send audio data to ElevenLabs
                if (
                    wsRef.current &&
                    wsRef.current.readyState === WebSocket.OPEN
                ) {
                    // Convert PCM data to base64 for ElevenLabs
                    const base64Audio = btoa(
                        String.fromCharCode(...new Uint8Array(pcmData.buffer))
                    );
                    wsRef.current.send(
                        JSON.stringify({
                            type: "user_audio_chunk",
                            audio_event: {
                                audio_base_64: base64Audio,
                            },
                        })
                    );
                }
            };

            source.connect(processor);
            processor.connect(audioContextRef.current.destination);

            setIsRecording(true);
        } catch (error) {
            console.error("Failed to start recording:", error);
        }
    };

    const stopRecording = () => {
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setIsRecording(false);

        // Send completion message to ElevenLabs
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "user_audio_complete" }));
        }
    };

    const playAudio = (audioData: any) => {
        try {
            console.log(
                "Playing audio, data type:",
                typeof audioData,
                "data:",
                audioData?.substring?.(0, 100)
            );

            let audioUrl: string;

            if (typeof audioData === "string") {
                // Check if it's base64 encoded
                if (audioData.startsWith("data:audio/")) {
                    // Already a data URL
                    audioUrl = audioData;
                } else {
                    try {
                        // Try to decode as base64
                        const audioBuffer = Uint8Array.from(
                            atob(audioData),
                            (c) => c.charCodeAt(0)
                        );
                        const blob = new Blob([audioBuffer], {
                            type: "audio/wav",
                        });
                        audioUrl = URL.createObjectURL(blob);
                    } catch (base64Error) {
                        console.error(
                            "Failed to decode base64 audio:",
                            base64Error
                        );
                        return;
                    }
                }
            } else if (
                audioData instanceof ArrayBuffer ||
                audioData instanceof Uint8Array
            ) {
                // Handle binary audio data
                const blob = new Blob([audioData as BlobPart], {
                    type: "audio/wav",
                });
                audioUrl = URL.createObjectURL(blob);
            } else {
                console.error(
                    "Unsupported audio data format:",
                    typeof audioData
                );
                return;
            }

            const audio = new Audio(audioUrl);
            audio.play().catch((error) => {
                console.error("Failed to play audio:", error);
            });

            // Clean up
            audio.onended = () => URL.revokeObjectURL(audioUrl);
        } catch (error) {
            console.error("Error in playAudio:", error);
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnectFromConversation();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="flex flex-col items-center space-y-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">
                    Real-Time Conversation
                </h3>
                <div
                    className={`px-3 py-1 rounded-full text-sm ${
                        isConnected
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    }`}
                >
                    {connectionStatus}
                </div>
            </div>

            <div className="flex space-x-4">
                <button
                    onClick={
                        isConnected
                            ? disconnectFromConversation
                            : connectToConversation
                    }
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                        isConnected
                            ? "bg-red-500 hover:bg-red-600 text-white"
                            : "bg-green-500 hover:bg-green-600 text-white"
                    }`}
                >
                    {isConnected ? <PhoneOff size={20} /> : <Phone size={20} />}
                    <span>{isConnected ? "End Call" : "Start Call"}</span>
                </button>

                <button
                    onClick={toggleRecording}
                    disabled={!isConnected}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                        isRecording
                            ? "bg-red-500 hover:bg-red-600 text-white"
                            : "bg-blue-500 hover:bg-blue-600 text-white"
                    } ${!isConnected ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                    {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                    <span>{isRecording ? "Stop Mic" : "Start Mic"}</span>
                </button>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md">
                {isConnected
                    ? "Your ElevenLabs agent is ready to have a real-time conversation!"
                    : "Click 'Start Call' to begin your real-time conversation with the AI interviewer."}
            </div>
        </div>
    );
};

export default RealTimeConversation;
