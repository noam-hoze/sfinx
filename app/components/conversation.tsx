"use client";

import { useConversation } from "@elevenlabs/react";
import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";

// Types for better type safety
interface MediaRecorderState {
    recorder: MediaRecorder | null;
    stream: MediaStream | null;
    chunks: Blob[];
}

interface ConversationState {
    cameraStarted: boolean;
    isRecording: boolean;
    error: string | null;
    isConnecting: boolean;
}



// Constants
const MEDIA_RECORDER_CONFIG = {
    mimeType: "video/webm",
} as const;

const MEDIA_CONSTRAINTS = {
    audio: true,
    video: true,
} as const;

export function Conversation() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorderState>({
        recorder: null,
        stream: null,
        chunks: [],
    });

    // Consolidated state for better performance
    const [state, setState] = useState<ConversationState>({
        cameraStarted: false,
        isRecording: false,
        error: null,
        isConnecting: false,
    });

    // Memoized conversation configuration
    const conversationConfig = useMemo(() => ({
        onConnect: () => {
            console.log("Connected");
            setState(prev => ({ ...prev, isConnecting: false }));
        },
        onDisconnect: () => {
            console.log("Disconnected");
            setState(prev => ({ ...prev, isConnecting: false }));
        },
        onMessage: (props: { message: string; source: string }) => console.log("Message:", props),
        onError: (message: string, context?: unknown) => {
            console.error("Conversation Error:", message, context);
            setState(prev => ({ ...prev, error: message || "Connection error", isConnecting: false }));
        },
    }), []);

    const conversation = useConversation(conversationConfig);

    // Memoized API call
    const getSignedUrl = useCallback(async (): Promise<string> => {
        try {
            const response = await fetch("/api/get-signed-url");
            if (!response.ok) {
                throw new Error(`Failed to get signed url: ${response.status} ${response.statusText}`);
            }
            const { signedUrl } = await response.json();
            if (!signedUrl) {
                throw new Error("Invalid signed URL received");
            }
            return signedUrl;
        } catch (error) {
            console.error("Error getting signed URL:", error);
            throw error;
        }
    }, []);

    // Cleanup function for proper resource management
    const cleanupResources = useCallback(() => {
        const { recorder, stream } = mediaRecorderRef.current;
        
        // Stop recording if active
        if (recorder && recorder.state !== "inactive") {
            recorder.stop();
        }
        
        // Stop all tracks in the stream
        if (stream) {
            stream.getTracks().forEach(track => {
                track.stop();
            });
        }
        
        // Clear video element
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        
        // Reset refs
        mediaRecorderRef.current = {
            recorder: null,
            stream: null,
            chunks: [],
        };
    }, []);

    const startConversation = useCallback(async () => {
        try {
            setState(prev => ({ ...prev, error: null, isConnecting: true }));
            
            const stream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            const recorder = new MediaRecorder(stream, MEDIA_RECORDER_CONFIG);
            const chunks: Blob[] = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            recorder.onstop = () => {
                setState(prev => ({ ...prev, isRecording: false }));
            };

            recorder.onerror = (event) => {
                console.error("MediaRecorder error:", event);
                setState(prev => ({ ...prev, error: "Recording error occurred" }));
            };

            // Update refs
            mediaRecorderRef.current = {
                recorder,
                stream,
                chunks,
            };

            recorder.start();
            setState(prev => ({ 
                ...prev, 
                isRecording: true, 
                cameraStarted: true,
                error: null 
            }));
            
        } catch (error) {
            console.error("Failed to start camera or conversation:", error);
            const errorMessage = error instanceof Error ? error.message : "Failed to access camera";
            setState(prev => ({ 
                ...prev, 
                error: errorMessage,
                isConnecting: false 
            }));
        }
    }, []);

    // Connect to ElevenLabs when camera starts
    useEffect(() => {
        if (state.cameraStarted && !conversation.status) {
            const connectToElevenLabs = async () => {
                try {
                    setState(prev => ({ ...prev, isConnecting: true }));
                    const signedUrl = await getSignedUrl();
                    await conversation.startSession({ signedUrl });
                } catch (error) {
                    console.error("Failed to start conversation session:", error);
                    const errorMessage = error instanceof Error ? error.message : "Failed to connect";
                    setState(prev => ({ 
                        ...prev, 
                        error: errorMessage,
                        isConnecting: false 
                    }));
                }
            };
            connectToElevenLabs();
        }
    }, [state.cameraStarted, conversation, getSignedUrl]);

    const stopConversation = useCallback(async () => {
        try {
            cleanupResources();
            await conversation.endSession();
            setState({
                cameraStarted: false,
                isRecording: false,
                error: null,
                isConnecting: false,
            });
        } catch (error) {
            console.error("Error stopping conversation:", error);
            // Force reload as fallback
            window.location.reload();
        }
    }, [cleanupResources, conversation]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanupResources();
        };
    }, [cleanupResources]);

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="relative aspect-video bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
                {/* Interviewer Image - Using Next.js Image for optimization */}
                <Image
                    src="https://placehold.co/1280x720/1a1a1a/ffffff?text=Interviewer"
                    alt="Interviewer"
                    fill
                    className="object-cover"
                    priority
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
                />

                {/* User's Video Feed */}
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`absolute right-0 bottom-0 w-1/4 h-auto bg-black rounded-lg border-2 border-gray-700 shadow-md transition-opacity duration-300 ${
                        state.cameraStarted ? "opacity-100" : "opacity-0"
                    }`}
                />
            </div>

            {/* Error Display */}
            {state.error && (
                <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
                    <p className="text-sm">Error: {state.error}</p>
                </div>
            )}

            <div className="flex justify-center gap-4 mt-6">
                <button
                    onClick={startConversation}
                    disabled={state.isRecording || state.isConnecting}
                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50 transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
                >
                    {state.isConnecting ? "Connecting..." : "Start Interview"}
                </button>
                <button
                    onClick={stopConversation}
                    disabled={!state.isRecording && !state.cameraStarted}
                    className="px-6 py-3 bg-red-600 text-white font-semibold rounded-full shadow-lg hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-400 focus:ring-opacity-50 transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
                >
                    Stop Interview
                </button>
            </div>

            <div className="text-center mt-4 text-gray-400">
                <p>
                    Status:{" "}
                    <span className="font-semibold text-white">
                        {state.isConnecting ? "Connecting..." : conversation.status || "Disconnected"}
                    </span>
                </p>
                {conversation.status === "connected" && (
                    <p className="text-sm mt-1">
                        {conversation.isSpeaking ? "🔊 Agent is speaking..." : "👂 Agent is listening..."}
                    </p>
                )}
            </div>
        </div>
    );
}
