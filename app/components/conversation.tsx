"use client";

import { useConversation } from "@elevenlabs/react";
import { useCallback, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export function Conversation() {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

    const [cameraStarted, setCameraStarted] = useState(false);
    const [isRecording, setIsRecording] = useState(false);

    const conversation = useConversation({
        onConnect: () => console.log("Connected"),
        onDisconnect: () => console.log("Disconnected"),
        onMessage: (message) => console.log("Message:", message),
        onError: (error) => console.error("Error:", error),
    });

    const getSignedUrl = async (): Promise<string> => {
        const response = await fetch("/api/get-signed-url");
        if (!response.ok) {
            throw new Error(`Failed to get signed url: ${response.statusText}`);
        }
        const { signedUrl } = await response.json();
        return signedUrl;
    };

    const startConversation = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            mediaRecorderRef.current = new MediaRecorder(stream, {
                mimeType: "video/webm",
            });
            recordedChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                setIsRecording(false);
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setCameraStarted(true);
        } catch (error) {
            console.error("Failed to start camera or conversation:", error);
        }
    }, [router]);

    useEffect(() => {
        if (cameraStarted) {
            const connectToElevenLabs = async () => {
                try {
                    const signedUrl = await getSignedUrl();
                    await conversation.startSession({ signedUrl });
                } catch (error) {
                    console.error(
                        "Failed to start conversation session:",
                        error
                    );
                }
            };
            connectToElevenLabs();
        }
    }, [cameraStarted, conversation]);

    const stopConversation = useCallback(async () => {
        window.location.reload();
    }, []);

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="relative aspect-video bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
                {/* Interviewer Image */}
                <img
                    src="https://placehold.co/1280x720/1a1a1a/ffffff?text=Interviewer"
                    alt="Interviewer"
                    className="w-full h-full object-cover"
                />

                {/* User's Video Feed */}
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    className={`absolute right-0 bottom-0 w-1/4 h-auto bg-black rounded-lg border-2 border-gray-700 shadow-md transition-opacity duration-300 ${
                        cameraStarted ? "opacity-100" : "opacity-0"
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
            </div>

            <div className="text-center mt-4 text-gray-400">
                <p>
                    Status:{" "}
                    <span className="font-semibold text-white">
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
