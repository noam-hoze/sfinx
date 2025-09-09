"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Moon, Sun, Loader2, Camera, CameraOff } from "lucide-react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import EditorPanel from "./editor/EditorPanel";
import ChatPanel from "./chat/ChatPanel";
import RealTimeConversation from "./chat/RealTimeConversation";
import {
    InterviewProvider,
    useInterview,
    useJobApplication,
} from "../../../lib";
import { useElevenLabsStateMachine } from "../../../lib/hooks/useElevenLabsStateMachine";
import { logger } from "../../../lib";

const InterviewerContent = () => {
    const { state, getCurrentTask, updateCurrentCode, updateSubmission } =
        useInterview();
    const { markCompanyApplied } = useJobApplication();
    const searchParams = useSearchParams();
    const companyId = searchParams.get("companyId");
    const jobId = searchParams.get("jobId");
    const [job, setJob] = useState<any | null>(null);
    const { data: session } = useSession();
    const candidateNameFromSession =
        (session?.user as any)?.name || "Candidate";

    // Callbacks for state machine
    const onElevenLabsUpdate = useCallback(async (text: string) => {
        if (realTimeConversationRef.current?.sendContextualUpdate) {
            try {
                await realTimeConversationRef.current.sendContextualUpdate(
                    text
                );
                logger.info("✅ Sent ElevenLabs KB update:", text);
            } catch (error) {
                logger.error("❌ Failed to send ElevenLabs update:", error);
                throw error;
            }
        } else {
            logger.warn("⚠️ ElevenLabs conversation not available for update");
        }
    }, []);

    const onSendUserMessage = useCallback(async (message: string) => {
        if (realTimeConversationRef.current?.sendUserMessage) {
            try {
                const messageSent =
                    await realTimeConversationRef.current.sendUserMessage(
                        message
                    );
                if (messageSent) {
                    logger.info(
                        "✅ AI usage notification message sent successfully"
                    );
                    return true;
                } else {
                    logger.error(
                        "❌ Failed to send AI usage notification message"
                    );
                    return false;
                }
            } catch (error) {
                logger.error(
                    "❌ Error sending AI usage notification message:",
                    error
                );
                return false;
            }
        } else {
            logger.warn(
                "⚠️ RealTimeConversation not available for sending user message"
            );
            return false;
        }
    }, []);

    // Initialize state machine (will be passed to RealTimeConversation)
    const {
        setCodingState,
        handleSubmission: stateMachineHandleSubmission,
        kbVariables,
        handleUserTranscript,
        updateKBVariables,
    } = useElevenLabsStateMachine(
        onElevenLabsUpdate,
        onSendUserMessage,
        candidateNameFromSession
    );
    const [showDiff, setShowDiff] = useState(false);
    const [originalCode, setOriginalCode] = useState("");
    const [modifiedCode, setModifiedCode] = useState("");
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [availableTabs, setAvailableTabs] = useState<
        Array<"editor" | "preview">
    >(["editor"]);
    const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
    const [isAISpeaking, setIsAISpeaking] = useState(false);
    const [isInterviewActive, setIsInterviewActive] = useState(false);
    const [isInterviewLoading, setIsInterviewLoading] = useState(false);
    const [isAgentConnected, setIsAgentConnected] = useState(false);
    const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes in seconds
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(
        null
    );
    const [isCodingStarted, setIsCodingStarted] = useState(false);
    const [micMuted, setMicMuted] = useState(false);
    const [showCompletionScreen, setShowCompletionScreen] = useState(false);
    const [applicationCreated, setApplicationCreated] = useState(false);
    const [interviewSessionId, setInterviewSessionId] = useState<string | null>(
        null
    );
    const [interviewConcluded, setInterviewConcluded] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const selfVideoRef = useRef<HTMLVideoElement | null>(null);
    const cameraStreamRef = useRef<MediaStream | null>(null);
    const cameraHideTimeoutRef = useRef<number | null>(null);

    // Debug: Monitor interviewSessionId changes
    useEffect(() => {
        logger.info("🔄 interviewSessionId changed to:", interviewSessionId);
    }, [interviewSessionId]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingPermissionGranted, setRecordingPermissionGranted] =
        useState(false);
    const [micPermissionGranted, setMicPermissionGranted] = useState(false);
    const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
    const [recordingUploaded, setRecordingUploaded] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const selectedMimeTypeRef = useRef<string>("");
    const interviewSessionIdRef = useRef<string | null>(null); // Use ref to avoid stale closures
    const realTimeConversationRef = useRef<any>(null);
    const doneMessageSentRef = useRef<boolean>(false);
    const router = useRouter();

    // Helper: send hidden completion signal once
    const sendHiddenDoneMessage = useCallback(async () => {
        if (doneMessageSentRef.current) return true;
        if (!realTimeConversationRef.current) return false;
        try {
            const messageSent =
                await realTimeConversationRef.current.sendUserMessage(
                    "I'm done. Please say your closing line and then end the connection."
                );
            if (messageSent) {
                console.log("✅ Special 'I'm done' message sent successfully");
                doneMessageSentRef.current = true;
            } else {
                console.error("❌ Failed to send 'I'm done' message");
            }
            return messageSent;
        } catch (error) {
            console.error("❌ Error sending 'I'm done' message:", error);
            return false;
        }
    }, []);

    // Require company name parameter
    useEffect(() => {
        if (!companyId) {
            router.push("/job-search");
        }
    }, [companyId, router]);

    // Fetch job + company by jobId for UI and logic
    useEffect(() => {
        const fetchJob = async () => {
            if (!jobId) return;
            try {
                const res = await fetch(`/api/jobs/${jobId}`);
                if (res.ok) {
                    const data = await res.json();
                    setJob(data.job);
                }
            } catch (_) {}
        };
        fetchJob();
    }, [jobId]);

    const toggleMicMute = useCallback(() => {
        if (realTimeConversationRef.current?.toggleMicMute) {
            realTimeConversationRef.current.toggleMicMute();
        }
    }, []);

    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240, facingMode: "user" },
                audio: false,
            });
            cameraStreamRef.current = stream;
            setIsCameraOn(true);
        } catch (error) {
            logger.error("❌ Failed to start camera:", error);
            setIsCameraOn(false);
        }
    }, []);

    const stopCamera = useCallback(() => {
        // Start fade-out first
        setIsCameraOn(false);
        if (cameraHideTimeoutRef.current) {
            window.clearTimeout(cameraHideTimeoutRef.current);
        }
        // Delay stream teardown to allow smooth fade-out
        cameraHideTimeoutRef.current = window.setTimeout(() => {
            if (cameraStreamRef.current) {
                cameraStreamRef.current.getTracks().forEach((t) => t.stop());
                cameraStreamRef.current = null;
            }
            if (selfVideoRef.current) {
                // @ts-ignore - srcObject is supported at runtime
                selfVideoRef.current.srcObject = null;
            }
        }, 350);
    }, []);

    useEffect(() => {
        if (isCameraOn && selfVideoRef.current && cameraStreamRef.current) {
            try {
                // @ts-ignore - srcObject is supported at runtime
                selfVideoRef.current.srcObject = cameraStreamRef.current;
                selfVideoRef.current.muted = true;
                // @ts-ignore - playsInline exists at runtime
                selfVideoRef.current.playsInline = true;
                const playPromise = selfVideoRef.current.play();
                if (playPromise && typeof playPromise.then === "function") {
                    playPromise.catch(() => {});
                }
            } catch (_) {}
        }
    }, [isCameraOn]);

    const toggleCamera = useCallback(() => {
        if (isCameraOn) {
            stopCamera();
        } else {
            startCamera();
        }
    }, [isCameraOn, startCamera, stopCamera]);

    useEffect(() => {
        return () => {
            stopCamera();
            if (cameraHideTimeoutRef.current) {
                window.clearTimeout(cameraHideTimeoutRef.current);
            }
        };
    }, [stopCamera]);

    // Function to upload recording to server and update database
    const uploadRecordingToServer = useCallback(
        async (blob: Blob) => {
            logger.info(
                "🔍 uploadRecordingToServer called with sessionId:",
                interviewSessionIdRef.current,
                "uploaded:",
                recordingUploaded
            );

            if (!interviewSessionIdRef.current || recordingUploaded) {
                logger.info(
                    "⏭️ Cannot upload: sessionId=",
                    interviewSessionIdRef.current,
                    "uploaded=",
                    recordingUploaded
                );
                return;
            }

            try {
                logger.info("📤 Starting server upload process...");

                // Upload recording
                const formData = new FormData();
                formData.append(
                    "recording",
                    blob,
                    `interview-${interviewSessionIdRef.current}.mp4`
                );

                logger.info(
                    "📤 Sending upload request to /api/interviews/session/screen-recording"
                );
                const uploadResponse = await fetch(
                    "/api/interviews/session/screen-recording",
                    {
                        method: "POST",
                        body: formData,
                    }
                );

                logger.info(
                    "📤 Upload response status:",
                    uploadResponse.status
                );

                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text();
                    logger.error("❌ Upload failed:", errorText);
                    throw new Error(
                        `Failed to upload recording: ${uploadResponse.status}`
                    );
                }

                const uploadData = await uploadResponse.json();
                logger.info("✅ Recording uploaded:", uploadData.recordingUrl);

                // Update interview session with recording URL
                logger.info(
                    "📤 Sending update request to:",
                    `/api/interviews/session/${interviewSessionIdRef.current}`
                );
                const updateResponse = await fetch(
                    `/api/interviews/session/${interviewSessionIdRef.current}`,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            videoUrl: uploadData.recordingUrl,
                        }),
                    }
                );

                logger.info(
                    "📤 Update response status:",
                    updateResponse.status
                );

                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    logger.error("❌ Update failed:", errorText);
                    throw new Error(
                        `Failed to update interview session: ${updateResponse.status}`
                    );
                }

                const updateData = await updateResponse.json();
                logger.info("✅ Interview session updated successfully");
                logger.info("📋 Updated session data:", updateData);
                setRecordingUploaded(true);
            } catch (error) {
                logger.error("❌ Error in uploadRecordingToServer:", error);
            }
        },
        [recordingUploaded]
    );

    // Screen recording functions
    const requestRecordingPermission = useCallback(async () => {
        try {
            // Get display media (screen + system audio)
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
            });

            // Get microphone audio
            const micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });

            // Combine audio tracks from both streams
            const combinedStream = new MediaStream();

            // Add video track from display
            displayStream.getVideoTracks().forEach((track) => {
                logger.info("🎥 Added video track:", track.label);
                combinedStream.addTrack(track);
            });

            // Add system audio track from display
            displayStream.getAudioTracks().forEach((track) => {
                logger.info("🔊 Added system audio track:", track.label);
                combinedStream.addTrack(track);
            });

            // Add microphone audio track
            micStream.getAudioTracks().forEach((track) => {
                logger.info("🎤 Added microphone audio track:", track.label);
                combinedStream.addTrack(track);
            });

            logger.info(
                "🎵 Combined stream tracks:",
                combinedStream
                    .getTracks()
                    .map((track) => `${track.kind}: ${track.label}`)
            );

            setMicPermissionGranted(true);
            setRecordingPermissionGranted(true);

            // Create MediaRecorder with fallback mime types
            let mimeType = "video/mp4;codecs=avc1";
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                logger.info("⚠️ H.264 not supported, trying basic mp4...");
                mimeType = "video/mp4";
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    logger.info("⚠️ MP4 not supported, using default");
                    mimeType = "";
                }
            }

            logger.info("🎥 Using mime type:", mimeType);

            const mediaRecorder = new MediaRecorder(
                combinedStream,
                mimeType ? { mimeType } : {}
            );

            mediaRecorderRef.current = mediaRecorder;
            recordedChunksRef.current = [];

            // Store the selected MIME type for consistent Blob creation
            selectedMimeTypeRef.current = mimeType;

            mediaRecorder.ondataavailable = (event) => {
                logger.info(
                    "📡 ondataavailable fired, data size:",
                    event.data.size
                );
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                    logger.info(
                        "📊 Chunks array length:",
                        recordedChunksRef.current.length
                    );
                }
            };

            mediaRecorder.onstop = async () => {
                logger.info(
                    "🛑 MediaRecorder stopped, processing recorded chunks..."
                );
                logger.info(
                    "📊 Recorded chunks count:",
                    recordedChunksRef.current.length
                );

                if (recordedChunksRef.current.length === 0) {
                    logger.warn("❌ No recorded chunks available");
                    return;
                }

                const blob = new Blob(recordedChunksRef.current, {
                    type: selectedMimeTypeRef.current || "video/mp4",
                });

                logger.info("📁 Created blob of size:", blob.size, "bytes");

                // Create object URL for the recording
                const url = URL.createObjectURL(blob);
                setRecordingUrl(url);

                // Store the blob for later upload (will be triggered by event handler)
                // Keep it as an array to maintain consistency
                recordedChunksRef.current = [blob];
                logger.info("✅ Recording captured, ready for upload");

                // Auto-upload and update database when recording is ready
                logger.info(
                    "🔍 onstop: interviewSessionId =",
                    interviewSessionIdRef.current,
                    "recordingUploaded =",
                    recordingUploaded
                );
                if (interviewSessionIdRef.current && !recordingUploaded) {
                    logger.info(
                        "🚀 Auto-uploading recording for session:",
                        interviewSessionIdRef.current
                    );
                    await uploadRecordingToServer(blob);
                } else {
                    logger.info(
                        "⏭️ Cannot auto-upload: sessionId=",
                        interviewSessionIdRef.current,
                        "uploaded=",
                        recordingUploaded
                    );
                }

                // Cleanup now that processing is done
                mediaRecorderRef.current = null;
                recordedChunksRef.current = [];
            };

            // Add cleanup handlers for when recording stops
            combinedStream.getTracks().forEach((track) => {
                track.onended = () => {
                    logger.info("🎵 Track ended:", track.kind, track.label);
                };
            });

            return true;
        } catch (error) {
            logger.error("❌ Error requesting recording permission:", error);

            // Provide more specific error messages
            if (error instanceof Error) {
                if (error.name === "NotAllowedError") {
                    logger.error(
                        "❌ Permission denied for screen recording or microphone"
                    );
                } else if (error.name === "NotFoundError") {
                    logger.error("❌ No screen or microphone found");
                } else if (error.name === "NotReadableError") {
                    logger.error("❌ Screen or microphone is already in use");
                }
            }

            setRecordingPermissionGranted(false);
            setMicPermissionGranted(false);
            return false;
        }
    }, [recordingUploaded, uploadRecordingToServer]);

    const startRecording = useCallback(async () => {
        if (!recordingPermissionGranted || !mediaRecorderRef.current) {
            const permissionGranted = await requestRecordingPermission();
            if (!permissionGranted) {
                logger.info(
                    "⏭️ Screen recording permission denied - not starting interview"
                );
                return false;
            }
        }

        if (mediaRecorderRef.current && !isRecording) {
            recordedChunksRef.current = [];
            // Start recording without a timeslice to avoid fragmented MP4 outputs
            mediaRecorderRef.current.start();
            setIsRecording(true);
            logger.info("✅ Screen recording started");
            return true;
        }

        // Already recording or no MediaRecorder available
        return false;
    }, [recordingPermissionGranted, isRecording, requestRecordingPermission]);

    const stopRecording = useCallback(async () => {
        if (mediaRecorderRef.current && isRecording) {
            // Request any remaining data before stopping
            if (mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.requestData();
            }

            mediaRecorderRef.current.stop();
            setIsRecording(false);

            // Stop all tracks to end the stream
            if (mediaRecorderRef.current.stream) {
                mediaRecorderRef.current.stream
                    .getTracks()
                    .forEach((track) => track.stop());
            }

            // Do NOT clear refs or chunks here; wait for onstop to finish processing
            logger.info("✅ Screen recording stopped");
        }
    }, [isRecording]);

    // Event handler for inserting recording URL (called manually, not in useEffect)
    const insertRecordingUrl = useCallback(async () => {
        logger.info("🚀 insertRecordingUrl called");
        logger.info("📋 Current state:", {
            interviewSessionId,
            recordingUrl,
            recordingUploaded,
            recordedChunksLength: recordedChunksRef.current.length,
        });

        if (!interviewSessionId) {
            logger.info("⏭️ No interview session ID available yet");
            return;
        }

        if (!recordingUrl) {
            logger.info("⏭️ No recording available to upload");
            return;
        }

        if (recordingUploaded) {
            logger.info("⏭️ Recording already uploaded");
            return;
        }

        // Get the stored blob from recordedChunksRef
        if (recordedChunksRef.current.length === 0) {
            logger.warn("⏭️ No recording blob available");
            return;
        }

        const blob = recordedChunksRef.current[0];
        if (!(blob instanceof Blob)) {
            logger.warn("⏭️ Invalid recording blob");
            return;
        }

        logger.info("📁 Blob details:", {
            size: blob.size,
            type: blob.type,
        });

        logger.info(
            "🚀 Event handler: Inserting recording URL for session:",
            interviewSessionId
        );

        try {
            logger.info("📤 Starting upload process...");

            // Upload recording
            const formData = new FormData();
            formData.append(
                "recording",
                blob,
                `interview-${interviewSessionId}.mp4`
            );

            logger.info(
                "📤 Sending upload request to /api/interviews/session/screen-recording"
            );
            const uploadResponse = await fetch(
                "/api/interviews/session/screen-recording",
                {
                    method: "POST",
                    body: formData,
                }
            );

            logger.info("📤 Upload response status:", uploadResponse.status);

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                logger.error("❌ Upload failed:", errorText);
                throw new Error(
                    `Failed to upload recording: ${uploadResponse.status}`
                );
            }

            const uploadData = await uploadResponse.json();
            logger.info("✅ Recording uploaded:", uploadData.recordingUrl);

            // Update interview session with recording URL
            logger.info(
                "📤 Sending update request to:",
                `/api/interviews/session/${interviewSessionId}`
            );
            const updateResponse = await fetch(
                `/api/interviews/session/${interviewSessionId}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        videoUrl: uploadData.recordingUrl,
                    }),
                }
            );

            logger.info("📤 Update response status:", updateResponse.status);

            if (!updateResponse.ok) {
                const errorText = await updateResponse.text();
                logger.error("❌ Update failed:", errorText);
                throw new Error(
                    `Failed to update interview session: ${updateResponse.status}`
                );
            }

            const updateData = await updateResponse.json();
            logger.info("✅ Interview session updated successfully");
            logger.info("📋 Updated session data:", updateData);
            setRecordingUploaded(true);
        } catch (error) {
            logger.error(
                "❌ Error in insertRecordingUrl event handler:",
                error
            );
        }
    }, [interviewSessionId, recordingUrl, recordingUploaded]);

    // Listen for mic state changes from RealTimeConversation
    useEffect(() => {
        const handleMicStateChange = (event: MessageEvent) => {
            if (event.data.type === "mic-state-changed") {
                setMicMuted(event.data.micMuted);
            }
        };

        window.addEventListener("message", handleMicStateChange);
        return () =>
            window.removeEventListener("message", handleMicStateChange);
    }, []);

    const handleInterviewButtonClick = useCallback(async () => {
        try {
            setIsInterviewLoading(true);

            // CRITICAL: Check screen recording permission FIRST
            // If user denies permission, do NOT proceed with interview setup
            logger.info("🔍 Requesting screen recording permission...");
            const recordingStarted = await startRecording();

            if (!recordingStarted) {
                logger.info(
                    "⏭️ Screen recording permission denied - interview not started"
                );
                setIsInterviewLoading(false);
                return; // Exit immediately, don't proceed with any interview setup
            }

            logger.info(
                "✅ Screen recording permission granted - proceeding with interview setup"
            );

            // Only proceed with interview setup if recording permission was granted

            // Create application if it doesn't exist
            if (!applicationCreated && companyId) {
                logger.info("🚀 Creating application for interview...");
                try {
                    const response = await fetch("/api/applications/create", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            companyId: companyId,
                            jobId: jobId,
                        }),
                    });

                    if (response.ok) {
                        const data = await response.json();
                        logger.info(
                            "✅ Application created for interview:",
                            data.application.id
                        );
                        setApplicationCreated(true);

                        // Now create interview session
                        logger.info("🚀 Creating interview session...");
                        const sessionResponse = await fetch(
                            "/api/interviews/session",
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    applicationId: data.application.id,
                                    companyId: companyId,
                                }),
                            }
                        );

                        if (sessionResponse.ok) {
                            const sessionData = await sessionResponse.json();
                            logger.info(
                                "✅ Interview session created:",
                                sessionData.interviewSession.id
                            );
                            logger.info(
                                "🔄 Setting interviewSessionId to:",
                                sessionData.interviewSession.id
                            );
                            setInterviewSessionId(
                                sessionData.interviewSession.id
                            );
                            interviewSessionIdRef.current =
                                sessionData.interviewSession.id;
                        } else {
                            console.error(
                                "❌ Failed to create interview session"
                            );
                        }
                    } else {
                        console.error(
                            "❌ Failed to create application for interview"
                        );
                    }
                } catch (error) {
                    console.error(
                        "❌ Error creating application/interview session:",
                        error
                    );
                }
            }

            // Reset editor code to initial state for new interview
            updateCurrentCode(getInitialCode());

            // Clear chat panel before starting new interview
            window.postMessage({ type: "clear-chat" }, "*");

            // Start real-time conversation (recording is already started above)
            await realTimeConversationRef.current?.startConversation();
            setIsInterviewActive(true);
            setIsInterviewLoading(false);

            logger.info("🎉 Interview started successfully!");
        } catch (error) {
            console.error("Failed to start interview:", error);
            setIsInterviewLoading(false);
        }
    }, [updateCurrentCode, applicationCreated, companyId, startRecording]);

    const handleStartCoding = async () => {
        setTimeLeft(30 * 60); // Reset to 30 minutes
        setIsTimerRunning(true);
        setIsCodingStarted(true);

        // Use state machine to set coding state
        await setCodingState(true);

        // Start timer only when user clicks
        const interval = setInterval(async () => {
            setTimeLeft((time) => {
                if (time <= 1) {
                    // Time's up - cleanup (same as submission)
                    console.log("⏰ Timer expired - ending interview...");

                    // Update local state (same as submission)
                    updateSubmission(state.currentCode);

                    // Stop screen recording (same as submission)
                    stopRecording();

                    // Use state machine to handle submission (same as submission)
                    stateMachineHandleSubmission(state.currentCode);
                    console.log(
                        "✅ Timer expired - submission handled via state machine"
                    );

                    // Send hidden completion message on timer expiration
                    sendHiddenDoneMessage();

                    setIsTimerRunning(false);
                    setIsCodingStarted(false);

                    clearInterval(interval);
                    return 0;
                }
                return time - 1;
            });
        }, 1000);

        setTimerInterval(interval);
    };

    const handleStopCoding = async () => {
        setIsTimerRunning(false);
        setIsCodingStarted(false);

        // Use state machine to stop coding
        await setCodingState(false);

        // Clear timer interval
        if (timerInterval) {
            clearInterval(timerInterval);
            setTimerInterval(null);
        }
    };

    // (Removed) Redundant telemetry creation; telemetry is created server-side with session

    const handleSubmit = async () => {
        try {
            // Update local state
            updateSubmission(state.currentCode);

            // Stop screen recording (upload will happen automatically in onstop handler)
            await stopRecording();

            // Use state machine to handle submission
            await stateMachineHandleSubmission(state.currentCode);
            console.log("✅ Submission handled via state machine");

            // Send hidden completion message on manual submit
            await sendHiddenDoneMessage();

            setIsTimerRunning(false);
            setIsCodingStarted(false);
        } catch (error) {
            console.error("❌ Failed to submit solution:", error);
        }
    };

    function getInitialCode(): string {
        return `// Welcome to your coding interview!
// Create a UserList component that fetches users from an API

const UserList = () => {
    // Fetch users from: https://jsonplaceholder.typicode.com/users
    // Display name and email for each user
    // Add loading and error states

    return (
        <div>
            <h2>User List</h2>
            {/* Implement your user list here */}
        </div>
    );
};

render(UserList);`;
    }

    // Initialize code on first load
    useEffect(() => {
        if (!state.currentCode) {
            updateCurrentCode(getInitialCode());
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Update code when task changes
    useEffect(() => {
        const currentTask = getCurrentTask();
        if (currentTask?.id === "task1-userlist") {
            updateCurrentCode(getInitialCode());
        }
    }, [state.currentTaskId, getCurrentTask]); // eslint-disable-line react-hooks/exhaustive-deps

    // Handle interview conclusion and completion screen
    useEffect(() => {
        const handleInterviewConclusion = async () => {
            if (interviewConcluded && companyId) {
                try {
                    // Update local state to mark company as applied
                    markCompanyApplied(companyId);

                    console.log("✅ Interview completed successfully");
                } catch (error) {
                    console.error(
                        "❌ Error handling interview conclusion:",
                        error
                    );
                }

                // Show completion screen and navigate back
                setShowCompletionScreen(true);
                setTimeout(() => {
                    router.push("/job-search");
                }, 2000);
            }
        };

        handleInterviewConclusion();
    }, [interviewConcluded, companyId, router, markCompanyApplied]);

    // Load theme preference and apply to document
    useEffect(() => {
        const savedTheme = localStorage.getItem("sfinx-theme");
        const shouldBeDark = savedTheme === "dark";
        setIsDarkMode(shouldBeDark);

        const root = document.documentElement;
        if (shouldBeDark) {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }, []);

    // Save theme preference and apply to document
    useEffect(() => {
        localStorage.setItem("sfinx-theme", isDarkMode ? "dark" : "light");

        const root = document.documentElement;
        if (isDarkMode) {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }, [isDarkMode]);

    // Format time helper
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs
            .toString()
            .padStart(2, "0")}`;
    };

    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
    };

    const handleCodeChange = (code: string) => {
        updateCurrentCode(code);
    };

    const handleApplyChanges = () => {
        updateCurrentCode(modifiedCode);
        setShowDiff(false);
    };

    const handleRejectChanges = () => {
        setShowDiff(false);
    };

    const handleRunCode = () => {
        if (!availableTabs.includes("preview")) {
            setAvailableTabs([...availableTabs, "preview"]);
        }
        setActiveTab("preview");
    };

    const handleTabSwitch = (tab: "editor" | "preview") => {
        if (availableTabs.includes(tab)) {
            setActiveTab(tab);
        }
    };

    // Completion Screen Component
    const CompletionScreen = () => (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-1000 ${
                showCompletionScreen
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
            }`}
        >
            <div className="text-center px-6">
                <div className="mb-8">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                        <svg
                            className="w-12 h-12 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    </div>
                </div>
                <h1 className="text-4xl font-light text-gray-900 mb-4 tracking-tight">
                    {`Thank you for your time ${candidateNameFromSession}`}
                </h1>
                <p className="text-xl text-gray-600 font-light">Good luck!</p>
            </div>
        </div>
    );

    const companyLogo = job?.company?.logo || "/logos/meta-logo.png";

    return (
        <div className="h-screen flex flex-col bg-soft-white text-deep-slate dark:bg-gray-900 dark:text-white">
            {/* Header */}
            <header className="border-b border-gray-200/30 dark:border-gray-700/30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl px-3 py-1">
                <div className="flex items-center justify-between max-w-8xl mx-auto">
                    {/* Left Section - Logo */}
                    <div className="flex items-center">
                        <h1 className="text-xl font-medium text-gray-900 dark:text-white tracking-tight">
                            Front-end Developer Interview
                        </h1>
                    </div>

                    {/* Center Section - Title */}
                    <div className="flex-1 flex justify-center items-center">
                        <div className="relative h-20 w-20">
                            <Image
                                src={companyLogo}
                                alt="Company Logo"
                                fill
                                sizes="80px"
                                className="object-contain scale-125"
                            />
                        </div>
                    </div>

                    {/* Right Section - Controls */}
                    <div className="flex items-center space-x-4">
                        {/* Camera toggle (preview appears in editor bottom-right) */}
                        <button
                            onClick={toggleCamera}
                            className={`p-2.5 rounded-full transition-all duration-200 hover:shadow-sm ${
                                isCameraOn
                                    ? "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/10 dark:text-green-400 dark:hover:bg-green-900/20"
                                    : "bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-700/70"
                            }`}
                            title={
                                isCameraOn
                                    ? "Turn camera off"
                                    : "Turn camera on"
                            }
                        >
                            {isCameraOn ? (
                                <CameraOff className="w-5 h-5" />
                            ) : (
                                <Camera className="w-5 h-5" />
                            )}
                        </button>
                        {/* Timer Display */}
                        {isCodingStarted && (
                            <div
                                className={`px-3 py-2 rounded-full font-mono text-sm font-semibold ${
                                    timeLeft < 300 // Less than 5 minutes
                                        ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                                }`}
                            >
                                {formatTime(timeLeft)}
                            </div>
                        )}

                        {/* Coding Control Button */}
                        <button
                            onClick={
                                isCodingStarted
                                    ? handleSubmit
                                    : handleStartCoding
                            }
                            disabled={!isInterviewActive && !isCodingStarted}
                            className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 hover:shadow-sm ${
                                isCodingStarted
                                    ? "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/10 dark:text-green-400 dark:hover:bg-green-900/20"
                                    : "bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/10 dark:text-purple-400 dark:hover:bg-purple-900/20"
                            } ${
                                !isInterviewActive && !isCodingStarted
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                            }`}
                            title={
                                isCodingStarted
                                    ? "Submit your solution"
                                    : isInterviewActive
                                    ? "Start 30-minute coding timer"
                                    : "Start interview first"
                            }
                        >
                            {isCodingStarted ? "Submit" : "Start Coding"}
                        </button>

                        {/* Interview Control Button */}
                        {!isInterviewActive && (
                            <button
                                onClick={handleInterviewButtonClick}
                                disabled={isInterviewLoading}
                                className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 hover:shadow-sm flex items-center gap-2 ${
                                    isInterviewLoading
                                        ? "bg-gray-100 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-400"
                                        : "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/10 dark:text-green-400 dark:hover:bg-green-900/20"
                                }`}
                                title={
                                    isInterviewLoading
                                        ? "Starting Interview..."
                                        : "Start Interview"
                                }
                            >
                                {isInterviewLoading && (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                )}
                                {isInterviewLoading
                                    ? "Starting Interview..."
                                    : "Start Interview"}
                            </button>
                        )}
                        <button
                            onClick={toggleTheme}
                            className="p-2.5 rounded-full bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-all duration-200 hover:shadow-sm"
                            title={
                                isDarkMode
                                    ? "Switch to Light Mode"
                                    : "Switch to Dark Mode"
                            }
                        >
                            {isDarkMode ? (
                                <Sun className="w-5 h-5" />
                            ) : (
                                <Moon className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden mt-6">
                <PanelGroup direction="horizontal">
                    {/* Middle Panel - Editor */}
                    <Panel defaultSize={70} minSize={50}>
                        <div className="h-full border-r bg-white border-light-gray dark:bg-gray-800 dark:border-gray-700 relative">
                            <EditorPanel
                                showDiff={showDiff}
                                originalCode={originalCode}
                                modifiedCode={modifiedCode}
                                currentCode={state.currentCode}
                                onCodeChange={handleCodeChange}
                                onApplyChanges={handleApplyChanges}
                                onRejectChanges={handleRejectChanges}
                                availableTabs={availableTabs}
                                activeTab={activeTab}
                                onTabSwitch={handleTabSwitch}
                                onRunCode={handleRunCode}
                                readOnly={!isCodingStarted}
                                onElevenLabsUpdate={onElevenLabsUpdate}
                                updateKBVariables={updateKBVariables}
                            />
                            <div
                                className={`absolute bottom-4 right-4 w-56 h-40 rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 bg-black transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                                    isCameraOn
                                        ? "opacity-100 translate-y-0 scale-100"
                                        : "opacity-0 translate-y-2 scale-[0.98] pointer-events-none"
                                }`}
                            >
                                <video
                                    ref={selfVideoRef}
                                    className="w-full h-full object-cover [transform:scaleX(-1)]"
                                    muted
                                    playsInline
                                    autoPlay
                                />
                            </div>
                        </div>
                    </Panel>

                    <PanelResizeHandle className="w-2 bg-light-gray hover:bg-electric-blue dark:bg-gray-600 dark:hover:bg-gray-500" />

                    {/* Right Panel - Voice Controls & Transcription */}
                    <Panel defaultSize={30} minSize={25}>
                        <div className="h-full flex flex-col border-t">
                            {/* Voice Controls (Top Quarter - 25%) */}
                            <div className="flex-[1] flex flex-col bg-white dark:bg-gray-800">
                                {/* Header */}
                                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <div
                                                className={`w-2 h-2 rounded-full ${
                                                    isInterviewActive &&
                                                    isAgentConnected
                                                        ? "bg-green-500"
                                                        : "bg-red-500"
                                                }`}
                                            ></div>
                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                                Carrey
                                            </h3>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Content */}
                                <div className="flex-1 p-4">
                                    <RealTimeConversation
                                        ref={realTimeConversationRef}
                                        isInterviewActive={isInterviewActive}
                                        candidateName={candidateNameFromSession}
                                        handleUserTranscript={
                                            handleUserTranscript
                                        }
                                        updateKBVariables={updateKBVariables}
                                        kbVariables={kbVariables}
                                        onStartConversation={() => {
                                            logger.info("Conversation started");
                                            setIsAgentConnected(true);
                                        }}
                                        onEndConversation={() => {
                                            logger.info("Conversation ended");
                                            setIsInterviewActive(false);
                                            setIsAgentConnected(false);
                                            setIsTimerRunning(false);
                                            setIsCodingStarted(false);

                                            // Clean up timer interval
                                            if (timerInterval) {
                                                clearInterval(timerInterval);
                                                setTimerInterval(null);
                                            }
                                        }}
                                        onInterviewConcluded={() => {
                                            setInterviewConcluded(true);
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Transcription Display (Bottom Three Quarters - 75%) */}
                            <div className="flex-[3] h-full overflow-hidden">
                                <ChatPanel
                                    micMuted={micMuted}
                                    onToggleMicMute={toggleMicMute}
                                />
                            </div>
                        </div>
                    </Panel>
                </PanelGroup>
            </div>

            {/* Completion Screen */}
            <CompletionScreen />
        </div>
    );
};

const InterviewIDE = () => {
    return (
        <InterviewProvider>
            <InterviewerContent />
        </InterviewProvider>
    );
};

export default InterviewIDE;
