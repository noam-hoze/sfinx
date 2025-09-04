"use client";

import {
    useEffect,
    useRef,
    useState,
    forwardRef,
    useImperativeHandle,
} from "react";
import StreamingAvatar, {
    TaskType,
    AvatarQuality,
} from "@heygen/streaming-avatar";

interface HeyGenInterviewProps {
    onVideoReady?: () => void;
    onSpeakingStart?: () => void;
    onSpeakingEnd?: () => void;
}

export interface HeyGenInterviewRef {
    startInterview: () => Promise<void>;
    stopInterview: () => Promise<void>;
    speakText: (text: string) => Promise<void>;
}

const HeyGenInterview = forwardRef<HeyGenInterviewRef, HeyGenInterviewProps>(
    ({ onVideoReady, onSpeakingStart, onSpeakingEnd }, ref) => {
        const [isInitialized, setIsInitialized] = useState(false);
        const [isSpeaking, setIsSpeaking] = useState(false);
        const [status, setStatus] = useState("Initializing...");
        const [hasVideo, setHasVideo] = useState(false);

        const avatarRef = useRef<StreamingAvatar | null>(null);
        const videoRef = useRef<HTMLVideoElement>(null);
        const startedRef = useRef(false);

        const setupMediaStream = (stream: MediaStream) => {
            console.log("🎥 Setting up HeyGen media stream");
            if (videoRef.current && stream) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch((e) => {
                    console.error("Video play error:", e);
                });
                setHasVideo(true);
                onVideoReady?.();
                console.log("✅ Video element connected to HeyGen stream");
            }
        };

        const initializeHeyGen = async () => {
            if (startedRef.current) return;

            try {
                setStatus("Connecting to HeyGen...");
                console.log("🚀 Initializing HeyGen avatar");

                // Use API key directly
                const apiKey =
                    "Mjk4ZjE3NzA3YWNhNDNmNmEwYzcwODdlOTBjYzZlYTMtMTc1MTY1MjMxMQ==";

                // Create HeyGen avatar instance
                const avatar = new StreamingAvatar({ token: apiKey });
                avatarRef.current = avatar;

                console.log("✅ HeyGen SDK initialized");

                setStatus("Avatar ready");
                setIsInitialized(true);
            } catch (error) {
                console.error("❌ Failed to initialize HeyGen:", error);
                setStatus("Initialization failed");
                setIsInitialized(false);
            }
        };

        const startInterview = async () => {
            if (!avatarRef.current) {
                throw new Error("HeyGen avatar not initialized");
            }

            try {
                setStatus("Starting interview session...");

                const avatar = avatarRef.current;

                // Start avatar session
                const session = await avatar.createStartAvatar({
                    avatarName: "Katya_Black_Suit_public",
                    quality: AvatarQuality.High,
                });

                console.log(
                    "🎯 Interview session started:",
                    session.session_id
                );

                // Set up media stream handling
                if (avatar.mediaStream) {
                    console.log("📺 Media stream available");
                    setupMediaStream(avatar.mediaStream);
                } else {
                    console.log("⏳ Waiting for media stream...");
                    avatar.on("stream_ready", (event: any) => {
                        console.log("🎬 Stream ready event received");
                        if (avatar.mediaStream) {
                            setupMediaStream(avatar.mediaStream);
                        }
                    });
                }

                // Resume audio context
                if (typeof window !== "undefined") {
                    try {
                        const AudioContext =
                            window.AudioContext ||
                            (window as any).webkitAudioContext;
                        const audioContext = new AudioContext();
                        if (audioContext.state === "suspended") {
                            await audioContext.resume();
                            console.log("🔊 Audio context resumed");
                        }
                    } catch (audioError) {
                        console.warn(
                            "Could not resume audio context:",
                            audioError
                        );
                    }
                }

                setStatus("Ready for conversation");
            } catch (error) {
                console.error("❌ Failed to start interview:", error);
                setStatus("Failed to start interview");
                throw error;
            }
        };

        const speakText = async (text: string) => {
            if (!avatarRef.current) {
                throw new Error("HeyGen avatar not initialized");
            }

            try {
                setIsSpeaking(true);
                setStatus("Speaking...");
                onSpeakingStart?.();

                console.log("🗣️ Avatar speaking:", text);

                await avatarRef.current.speak({
                    text: text,
                    task_type: TaskType.REPEAT,
                });

                console.log("✅ Avatar finished speaking");
                setIsSpeaking(false);
                setStatus("Listening...");
                onSpeakingEnd?.();
            } catch (error) {
                console.error("❌ Failed to speak:", error);
                setIsSpeaking(false);
                setStatus("Speech error");
                onSpeakingEnd?.();
                throw error;
            }
        };

        const stopInterview = async () => {
            if (!avatarRef.current) return;

            try {
                setStatus("Stopping interview...");
                console.log("🛑 Stopping HeyGen session");

                const avatar = avatarRef.current;

                // Clean up media resources (SDK methods may not be available)
                console.log("🧹 Cleaning up HeyGen resources...");

                // Clear media stream
                if (avatar.mediaStream) {
                    avatar.mediaStream.getTracks().forEach((track) => {
                        track.stop();
                        console.log("✅ Media track stopped:", track.kind);
                    });
                }

                // Clear video element
                if (videoRef.current) {
                    videoRef.current.srcObject = null;
                    setHasVideo(false);
                    console.log("✅ Video element cleared");
                }

                setStatus("Interview stopped");
                setIsSpeaking(false);
                setIsInitialized(false);
                onSpeakingEnd?.();

                console.log("✅ HeyGen interview fully terminated");
            } catch (error) {
                console.error("❌ Failed to stop interview:", error);
                // Still try to reset state even if cleanup fails
                setStatus("Interview stopped (with errors)");
                setIsSpeaking(false);
                setIsInitialized(false);
                onSpeakingEnd?.();
            }
        };

        // Initialize HeyGen when component mounts
        useEffect(() => {
            initializeHeyGen();

            // Cleanup when component unmounts
            return () => {
                console.log("🧹 Cleaning up HeyGen interview component");
                if (avatarRef.current) {
                    try {
                        // Stop media tracks
                        if (avatarRef.current.mediaStream) {
                            avatarRef.current.mediaStream
                                .getTracks()
                                .forEach((track) => {
                                    track.stop();
                                });
                        }
                        // Clear video element
                        if (videoRef.current) {
                            videoRef.current.srcObject = null;
                        }
                    } catch (error) {
                        console.warn("⚠️ Error during cleanup:", error);
                    }
                }
            };
        }, []);

        // Expose methods to parent component
        useImperativeHandle(ref, () => ({
            startInterview,
            stopInterview,
            speakText,
        }));

        return (
            <div className="w-full space-y-4">
                {/* Video Element */}
                <div className="relative bg-black rounded-lg overflow-hidden">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted={false}
                        className="w-full h-64 object-cover"
                    >
                        Your browser does not support the video tag.
                    </video>

                    {!hasVideo && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-white text-center">
                                <div className="text-lg mb-2">
                                    {isInitialized
                                        ? "🎥 Waiting for video..."
                                        : "⚙️ Initializing..."}
                                </div>
                                <div className="text-sm opacity-75">
                                    {status}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }
);

HeyGenInterview.displayName = "HeyGenInterview";

export default HeyGenInterview;
