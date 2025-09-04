"use client";
import { useEffect, useRef, useState } from "react";
import StreamingAvatar, {
    TaskType,
    AvatarQuality,
} from "@heygen/streaming-avatar";

export default function HeyGenTestPage() {
    const [isStarted, setIsStarted] = useState(false);
    const [status, setStatus] = useState("Ready to start avatar");
    const [hasVideo, setHasVideo] = useState(false);
    const avatarRef = useRef<StreamingAvatar | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const startedRef = useRef(false);

    const setupMediaStream = (stream: MediaStream) => {
        console.log("Setting up media stream");
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current
                .play()
                .catch((e) => console.error("Video play error:", e));
            setHasVideo(true);
            console.log("Video element connected to stream");
        }
    };

    const startAvatar = async () => {
        if (startedRef.current) return;
        startedRef.current = true;
        setIsStarted(true);

        try {
            setStatus("Initializing SDK...");

            // 1) Use API key from environment
            const apiKey = process.env.HEYGEN_API_KEY;

            if (!apiKey) {
                throw new Error(
                    "HEYGEN_API_KEY environment variable is not set"
                );
            }

            console.log("Initializing SDK with API key");

            // 2) Create the SDK with API key from environment
            const avatar = new StreamingAvatar({ token: apiKey });
            avatarRef.current = avatar;

            setStatus("Creating avatar session...");

            // 3) Start an avatar session (let SDK handle session creation)
            const session = await avatar.createStartAvatar({
                avatarName: "Katya_Black_Suit_public",
                quality: AvatarQuality.High,
            });
            console.log("Session created:", session.session_id);

            setStatus("Avatar session created! Setting up media streams...");

            // 4) Set up media stream handling
            if (avatar.mediaStream) {
                console.log("Media stream available, setting up video/audio");
                setupMediaStream(avatar.mediaStream);
            } else {
                console.log("Waiting for media stream...");
                // Listen for stream ready event
                avatar.on("stream_ready", (event: any) => {
                    console.log("Stream ready event received");
                    if (avatar.mediaStream) {
                        setupMediaStream(avatar.mediaStream);
                    }
                });
            }

            // 5) Resume audio context if needed
            if (typeof window !== "undefined") {
                try {
                    if (
                        "audioContext" in window ||
                        "webkitAudioContext" in window
                    ) {
                        const AudioContext =
                            window.AudioContext ||
                            (window as any).webkitAudioContext;
                        const audioContext = new AudioContext();
                        if (audioContext.state === "suspended") {
                            await audioContext.resume();
                            console.log("Audio context resumed");
                        }
                    }
                } catch (audioError) {
                    console.warn("Could not resume audio context:", audioError);
                }
            }

            // 6) Speak
            setStatus("Avatar session created! Speaking...");
            await avatar.speak({
                text: "Hi Noam, how are you today? Are you feeling well or what?",
                task_type: TaskType.REPEAT,
            });
            console.log("Avatar should be speaking now");

            setStatus("Avatar is speaking! Check video and audio.");
        } catch (e) {
            console.error("Error in startSession:", e);
            setStatus("Error: " + (e as any)?.message || "Unknown error");

            // Log more details about the error
            if (e && typeof e === "object" && "message" in e) {
                console.error("Error message:", (e as any).message);
            }
            if (e && typeof e === "object" && "response" in e) {
                console.error("Error response:", (e as any).response);
            }
        }
    };

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">HeyGen Avatar Test</h1>
            <p className="mb-4">
                Status: <span className="font-semibold">{status}</span>
            </p>

            {!isStarted ? (
                <button
                    onClick={startAvatar}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
                >
                    Start Avatar (Click to Enable Audio)
                </button>
            ) : (
                <p className="text-green-600 mb-4">
                    Avatar session started! Audio should be working now.
                </p>
            )}

            {/* Video Element for Avatar Display */}
            <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Avatar Video:</h2>
                <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-black relative">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted={false}
                        className="w-full max-w-2xl h-auto"
                        style={{ minHeight: "400px" }}
                    >
                        Your browser does not support the video tag.
                    </video>
                    {!hasVideo && (
                        <div className="absolute inset-0 flex items-center justify-center text-white text-lg">
                            {isStarted
                                ? "Waiting for video stream..."
                                : "Click Start Avatar to begin"}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-4 text-sm text-gray-600 space-y-2">
                <p>
                    <strong>Note:</strong> Modern browsers require user
                    interaction before audio can play.
                </p>
                <p>
                    This is why we need to click "Start Avatar" to enable the
                    audio context.
                </p>
                <p>
                    <strong>Troubleshooting:</strong> If you don't hear audio,
                    check your browser's audio settings and try refreshing the
                    page.
                </p>
            </div>
        </div>
    );
}
