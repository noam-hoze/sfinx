"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Image from "next/image";
import { useSession } from "next-auth/react";
import EditorPanel from "./editor/EditorPanel";
import InterviewOverlay from "./InterviewOverlay";
import CameraPreview from "./CameraPreview";
import HeaderControls from "./HeaderControls";
import RightPanel from "./RightPanel";
import {
    InterviewProvider,
    useInterview,
    useJobApplication,
} from "../../../lib";
import { useElevenLabsStateMachine } from "../../../lib/hooks/useElevenLabsStateMachine";
import { logger } from "../../../lib";
const log = logger.for("@InterviewIDE.tsx");

const InterviewerContent = () => {
    const {
        state,
        getCurrentTask,
        updateCurrentCode,
        updateSubmission,
        setCodingStarted,
        queueContextUpdate,
        queueUserMessage,
    } = useInterview();
    const { markCompanyApplied } = useJobApplication();
    const searchParams = useSearchParams();
    const companyId = searchParams.get("companyId");
    const jobId = searchParams.get("jobId");
    const [job, setJob] = useState<any | null>(null);
    const { data: session } = useSession();
    const candidateNameFromSession =
        (session?.user as any)?.name || "Candidate";

    // Callbacks for state machine
    const onElevenLabsUpdate = useCallback(
        async (text: string) => {
            // Refactor: enqueue context update to be flushed by RealTimeConversation
            try {
                queueContextUpdate(text);
                logger.info("✅ Queued ElevenLabs KB update:", text);
            } catch (error) {
                logger.error("❌ Failed to queue ElevenLabs update:", error);
                throw error;
            }
        },
        [queueContextUpdate]
    );

    const onSendUserMessage = useCallback(
        async (message: string) => {
            // Refactor: enqueue user message to be flushed by RealTimeConversation
            try {
                queueUserMessage(message);
                logger.info("✅ Queued user message:", message);
                return true;
            } catch (error) {
                logger.error("❌ Failed to queue user message:", error);
                return false;
            }
        },
        [queueUserMessage]
    );

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
        log.info("🔄 interviewSessionId changed to:", interviewSessionId);
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
    const automaticMode = process.env.NEXT_PUBLIC_AUTOMATIC_MODE === "true";
    // Start button now lives inside the overlay. No header button needed.

    // Helper: send hidden completion signal once
    const sendHiddenDoneMessage = useCallback(async () => {
        if (doneMessageSentRef.current) return true;
        try {
            queueUserMessage(
                "I'm done. Please say your closing line and then end the connection."
            );
            console.log("✅ Special 'I'm done' message queued successfully");
            doneMessageSentRef.current = true;
            return true;
        } catch (error) {
            console.error("❌ Error sending 'I'm done' message:", error);
            return false;
        }
    }, [queueUserMessage]);

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
            log.error("❌ Failed to start camera:", error);
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
        // Auto-start camera preview on page load
        startCamera();
        return () => {
            stopCamera();
            if (cameraHideTimeoutRef.current) {
                window.clearTimeout(cameraHideTimeoutRef.current);
            }
        };
    }, [startCamera, stopCamera]);

    // Function to upload recording to server and update database
    const uploadRecordingToServer = useCallback(
        async (blob: Blob) => {
            log.info(
                "🔍 uploadRecordingToServer called with sessionId:",
                interviewSessionIdRef.current,
                "uploaded:",
                recordingUploaded
            );

            if (!interviewSessionIdRef.current || recordingUploaded) {
                log.info(
                    "⏭️ Cannot upload: sessionId=",
                    interviewSessionIdRef.current,
                    "uploaded=",
                    recordingUploaded
                );
                return;
            }

            try {
                log.info("📤 Starting server upload process...");

                // Upload recording
                const formData = new FormData();
                formData.append(
                    "recording",
                    blob,
                    `interview-${interviewSessionIdRef.current}.mp4`
                );

                log.info(
                    "📤 Sending upload request to /api/interviews/session/screen-recording"
                );
                const uploadResponse = await fetch(
                    "/api/interviews/session/screen-recording",
                    {
                        method: "POST",
                        body: formData,
                    }
                );

                log.info("📤 Upload response status:", uploadResponse.status);

                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text();
                    log.error("❌ Upload failed:", errorText);
                    throw new Error(
                        `Failed to upload recording: ${uploadResponse.status}`
                    );
                }

                const uploadData = await uploadResponse.json();
                log.info("✅ Recording uploaded:", uploadData.recordingUrl);

                // Update interview session with recording URL
                log.info(
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

                log.info("📤 Update response status:", updateResponse.status);

                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    log.error("❌ Update failed:", errorText);
                    throw new Error(
                        `Failed to update interview session: ${updateResponse.status}`
                    );
                }

                const updateData = await updateResponse.json();
                log.info("✅ Interview session updated successfully");
                log.info("📋 Updated session data:", updateData);
                setRecordingUploaded(true);
            } catch (error) {
                log.error("❌ Error in uploadRecordingToServer:", error);
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
                log.info("🎥 Added video track:", track.label);
                combinedStream.addTrack(track);
            });

            // Add system audio track from display
            displayStream.getAudioTracks().forEach((track) => {
                log.info("🔊 Added system audio track:", track.label);
                combinedStream.addTrack(track);
            });

            // Add microphone audio track
            micStream.getAudioTracks().forEach((track) => {
                log.info("🎤 Added microphone audio track:", track.label);
                combinedStream.addTrack(track);
            });

            log.info(
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
                log.info("⚠️ H.264 not supported, trying basic mp4...");
                mimeType = "video/mp4";
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    log.info("⚠️ MP4 not supported, using default");
                    mimeType = "";
                }
            }

            log.info("🎥 Using mime type:", mimeType);

            const mediaRecorder = new MediaRecorder(
                combinedStream,
                mimeType ? { mimeType } : {}
            );

            mediaRecorderRef.current = mediaRecorder;
            recordedChunksRef.current = [];

            // Store the selected MIME type for consistent Blob creation
            selectedMimeTypeRef.current = mimeType;

            mediaRecorder.ondataavailable = (event) => {
                log.info(
                    "📡 ondataavailable fired, data size:",
                    event.data.size
                );
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                    log.info(
                        "📊 Chunks array length:",
                        recordedChunksRef.current.length
                    );
                }
            };

            mediaRecorder.onstop = async () => {
                log.info(
                    "🛑 MediaRecorder stopped, processing recorded chunks..."
                );
                log.info(
                    "📊 Recorded chunks count:",
                    recordedChunksRef.current.length
                );

                if (recordedChunksRef.current.length === 0) {
                    log.warn("❌ No recorded chunks available");
                    return;
                }

                const blob = new Blob(recordedChunksRef.current, {
                    type: selectedMimeTypeRef.current || "video/mp4",
                });

                log.info("📁 Created blob of size:", blob.size, "bytes");

                // Create object URL for the recording
                const url = URL.createObjectURL(blob);
                setRecordingUrl(url);

                // Store the blob for later upload (will be triggered by event handler)
                // Keep it as an array to maintain consistency
                recordedChunksRef.current = [blob];
                log.info("✅ Recording captured, ready for upload");

                // Auto-upload and update database when recording is ready
                log.info(
                    "🔍 onstop: interviewSessionId =",
                    interviewSessionIdRef.current,
                    "recordingUploaded =",
                    recordingUploaded
                );
                if (interviewSessionIdRef.current && !recordingUploaded) {
                    log.info(
                        "🚀 Auto-uploading recording for session:",
                        interviewSessionIdRef.current
                    );
                    await uploadRecordingToServer(blob);
                } else {
                    log.info(
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
                    log.info("🎵 Track ended:", track.kind, track.label);
                };
            });

            return true;
        } catch (error) {
            log.error("❌ Error requesting recording permission:", error);

            // Provide more specific error messages
            if (error instanceof Error) {
                if (error.name === "NotAllowedError") {
                    log.error(
                        "❌ Permission denied for screen recording or microphone"
                    );
                } else if (error.name === "NotFoundError") {
                    log.error("❌ No screen or microphone found");
                } else if (error.name === "NotReadableError") {
                    log.error("❌ Screen or microphone is already in use");
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
                log.info(
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
            log.info("✅ Screen recording started");
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
            log.info("✅ Screen recording stopped");
        }
    }, [isRecording]);

    // Event handler for inserting recording URL (called manually, not in useEffect)
    const insertRecordingUrl = useCallback(async () => {
        log.info("🚀 insertRecordingUrl called");
        log.info("📋 Current state:", {
            interviewSessionId,
            recordingUrl,
            recordingUploaded,
            recordedChunksLength: recordedChunksRef.current.length,
        });

        if (!interviewSessionId) {
            log.info("⏭️ No interview session ID available yet");
            return;
        }

        if (!recordingUrl) {
            log.info("⏭️ No recording available to upload");
            return;
        }

        if (recordingUploaded) {
            log.info("⏭️ Recording already uploaded");
            return;
        }

        // Get the stored blob from recordedChunksRef
        if (recordedChunksRef.current.length === 0) {
            log.warn("⏭️ No recording blob available");
            return;
        }

        const blob = recordedChunksRef.current[0];
        if (!(blob instanceof Blob)) {
            log.warn("⏭️ Invalid recording blob");
            return;
        }

        log.info("📁 Blob details:", {
            size: blob.size,
            type: blob.type,
        });

        log.info(
            "🚀 Event handler: Inserting recording URL for session:",
            interviewSessionId
        );

        try {
            log.info("📤 Starting upload process...");

            // Upload recording
            const formData = new FormData();
            formData.append(
                "recording",
                blob,
                `interview-${interviewSessionId}.mp4`
            );

            log.info(
                "📤 Sending upload request to /api/interviews/session/screen-recording"
            );
            const uploadResponse = await fetch(
                "/api/interviews/session/screen-recording",
                {
                    method: "POST",
                    body: formData,
                }
            );

            log.info("📤 Upload response status:", uploadResponse.status);

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                log.error("❌ Upload failed:", errorText);
                throw new Error(
                    `Failed to upload recording: ${uploadResponse.status}`
                );
            }

            const uploadData = await uploadResponse.json();
            log.info("✅ Recording uploaded:", uploadData.recordingUrl);

            // Update interview session with recording URL
            log.info(
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

            log.info("📤 Update response status:", updateResponse.status);

            if (!updateResponse.ok) {
                const errorText = await updateResponse.text();
                log.error("❌ Update failed:", errorText);
                throw new Error(
                    `Failed to update interview session: ${updateResponse.status}`
                );
            }

            const updateData = await updateResponse.json();
            log.info("✅ Interview session updated successfully");
            log.info("📋 Updated session data:", updateData);
            setRecordingUploaded(true);
        } catch (error) {
            log.error("❌ Error in insertRecordingUrl event handler:", error);
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
            log.info("🔍 Requesting screen recording permission...");
            const recordingStarted = await startRecording();

            if (!recordingStarted) {
                log.info(
                    "⏭️ Screen recording permission denied - interview not started"
                );
                setIsInterviewLoading(false);
                return; // Exit immediately, don't proceed with any interview setup
            }

            log.info(
                "✅ Screen recording permission granted - proceeding with interview setup"
            );

            // Only proceed with interview setup if recording permission was granted

            // Create application if it doesn't exist
            if (!applicationCreated && companyId) {
                log.info("🚀 Creating application for interview...");
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
                        log.info(
                            "✅ Application created for interview:",
                            data.application.id
                        );
                        setApplicationCreated(true);

                        // Now create interview session
                        log.info("🚀 Creating interview session...");
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
                            log.info(
                                "✅ Interview session created:",
                                sessionData.interviewSession.id
                            );
                            log.info(
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

            log.info("🎉 Interview started successfully!");
        } catch (error) {
            console.error("Failed to start interview:", error);
            setIsInterviewLoading(false);
        }
    }, [updateCurrentCode, applicationCreated, companyId, startRecording]);

    const handleStartCoding = async () => {
        setTimeLeft(30 * 60); // Reset to 30 minutes
        setIsTimerRunning(true);
        setIsCodingStarted(true);
        setCodingStarted(true);

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
        setCodingStarted(false);

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
            log.info("✅ Submission handled via state machine");

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

    // Format time helper
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs
            .toString()
            .padStart(2, "0")}`;
    };

    const handleCodeChange = (code: string) => {
        updateCurrentCode(code);
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

    // Completion screen now extracted

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
                    <HeaderControls
                        isCameraOn={isCameraOn}
                        onToggleCamera={toggleCamera}
                        isCodingStarted={isCodingStarted}
                        timeLeft={timeLeft}
                        formatTime={formatTime}
                        automaticMode={automaticMode}
                        isInterviewActive={isInterviewActive}
                        onStartCoding={handleStartCoding}
                        onSubmit={handleSubmit}
                    />
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
                                availableTabs={availableTabs}
                                activeTab={activeTab}
                                onTabSwitch={handleTabSwitch}
                                onRunCode={handleRunCode}
                                readOnly={!isCodingStarted}
                                onElevenLabsUpdate={onElevenLabsUpdate}
                                updateKBVariables={updateKBVariables}
                            />
                            <InterviewOverlay
                                isCodingStarted={isCodingStarted}
                                isInterviewActive={isInterviewActive}
                                isInterviewLoading={isInterviewLoading}
                                isAgentConnected={isAgentConnected}
                                interviewConcluded={interviewConcluded}
                                hasSubmitted={state.hasSubmitted}
                                candidateName={candidateNameFromSession}
                                onStartInterview={handleInterviewButtonClick}
                            />
                            <CameraPreview
                                isCameraOn={isCameraOn}
                                videoRef={selfVideoRef}
                            />
                        </div>
                    </Panel>

                    <PanelResizeHandle className="w-2 bg-light-gray hover:bg-electric-blue dark:bg-gray-600 dark:hover:bg-gray-500" />

                    {/* Right Panel - Voice Controls & Transcription */}
                    <Panel defaultSize={30} minSize={25}>
                        <RightPanel
                            isInterviewActive={isInterviewActive}
                            candidateName={candidateNameFromSession}
                            handleUserTranscript={handleUserTranscript}
                            updateKBVariables={updateKBVariables}
                            kbVariables={kbVariables}
                            automaticMode={automaticMode}
                            isCodingStarted={isCodingStarted}
                            onAutoStartCoding={() => {
                                if (!isCodingStarted) {
                                    handleStartCoding();
                                }
                            }}
                            onStartConversation={() => {
                                log.info("Conversation started");
                                setIsInterviewLoading(false);
                            }}
                            onEndConversation={() => {
                                log.info("Conversation ended");
                                setIsTimerRunning(false);
                                setIsCodingStarted(false);
                                setIsInterviewLoading(false);
                            }}
                            onInterviewConcluded={() =>
                                setInterviewConcluded(true)
                            }
                            micMuted={micMuted}
                            onToggleMicMute={toggleMicMute}
                            realTimeConversationRef={realTimeConversationRef}
                            isAgentConnected={isAgentConnected}
                            setIsAgentConnected={setIsAgentConnected}
                            setIsInterviewActive={setIsInterviewActive}
                            timerInterval={timerInterval}
                            clearTimerInterval={() => {
                                if (timerInterval) {
                                    clearInterval(timerInterval);
                                    setTimerInterval(null);
                                }
                            }}
                        />
                    </Panel>
                </PanelGroup>
            </div>

            {/* Completion screen removed, handled by overlay */}
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
