"use client";

import { useConversation } from "@elevenlabs/react";
import { useCallback, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

// Constants
const MEDIA_CONFIG = {
    audio: true,
    video: true,
    mimeType: "video/webm",
    filename: "interview_recording.webm"
} as const;

const STYLES = {
    container: "w-full max-w-4xl mx-auto",
    videoWrapper: "relative aspect-video bg-gray-900 rounded-2xl shadow-2xl overflow-hidden",
    userVideo: "absolute right-0 bottom-0 w-1/4 h-auto bg-black rounded-lg border-2 border-gray-700 shadow-md transition-opacity duration-300",
    buttonContainer: "flex justify-center gap-4 mt-6",
    button: "px-6 py-3 font-semibold rounded-full shadow-lg focus:outline-none focus:ring-4 focus:ring-opacity-50 transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed",
    startButton: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-400",
    stopButton: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-400",
    statusContainer: "text-center mt-4 text-gray-400"
} as const;

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

    const setupMediaStream = async () => {
        const stream = await navigator.mediaDevices.getUserMedia(MEDIA_CONFIG);
        
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }

        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: MEDIA_CONFIG.mimeType
        });
        
        recordedChunksRef.current = [];
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunksRef.current.push(event.data);
            }
        };

        mediaRecorder.onstop = handleRecordingStop;
        mediaRecorderRef.current = mediaRecorder;
        
        return mediaRecorder;
    };

    const handleRecordingStop = async () => {
        const blob = new Blob(recordedChunksRef.current, {
            type: MEDIA_CONFIG.mimeType
        });

        const formData = new FormData();
        formData.append("video", blob, MEDIA_CONFIG.filename);

        try {
            const response = await fetch("/api/upload-video", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("Video upload failed");

            const result = await response.json();
            console.log("Video upload successful:", result);
            
            if (result.videoId) {
                router.push(`/results/${result.videoId}`);
            }
        } catch (error) {
            console.error("Error uploading video:", error);
        } finally {
            setIsRecording(false);
        }
    };

    const startConversation = useCallback(async () => {
        try {
            const mediaRecorder = await setupMediaStream();
            mediaRecorder.start();
            setIsRecording(true);
            setCameraStarted(true);
        } catch (error) {
            console.error("Failed to start camera or conversation:", error);
        }
    }, [router]);

    const stopConversation = useCallback(async () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
        }

        if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        
        setCameraStarted(false);
        await conversation.endSession();
    }, [conversation, isRecording]);

    useEffect(() => {
        if (!cameraStarted) return;

        const connectToElevenLabs = async () => {
            try {
                const signedUrl = await getSignedUrl();
                await conversation.startSession({ signedUrl });
            } catch (error) {
                console.error("Failed to start conversation session:", error);
            }
        };
        
        connectToElevenLabs();
    }, [cameraStarted, conversation]);

    const getStatusText = () => {
        if (conversation.status !== "connected") return null;
        return conversation.isSpeaking ? "Agent is speaking..." : "Agent is listening...";
    };

    return (
        <div className={STYLES.container}>
            <div className={STYLES.videoWrapper}>
                <img
                    src="https://placehold.co/1280x720/1a1a1a/ffffff?text=Interviewer"
                    alt="Interviewer"
                    className="w-full h-full object-cover"
                />

                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    className={`${STYLES.userVideo} ${
                        cameraStarted ? "opacity-100" : "opacity-0"
                    }`}
                />
            </div>

            <div className={STYLES.buttonContainer}>
                <button
                    onClick={startConversation}
                    disabled={isRecording}
                    className={`${STYLES.button} ${STYLES.startButton}`}
                >
                    Start Interview
                </button>
                <button
                    onClick={stopConversation}
                    disabled={!isRecording}
                    className={`${STYLES.button} ${STYLES.stopButton}`}
                >
                    Stop Interview
                </button>
            </div>

            <div className={STYLES.statusContainer}>
                <p>
                    Status:{" "}
                    <span className="font-semibold text-white">
                        {conversation.status}
                    </span>
                </p>
                {getStatusText() && <p>{getStatusText()}</p>}
            </div>
        </div>
    );
}
