"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Moon, Sun, Video, VideoOff } from "lucide-react";
import Image from "next/image";
import EditorPanel from "./editor/EditorPanel";
import ChatPanel from "./chat/ChatPanel";
import RealTimeConversation from "./chat/RealTimeConversation";
import {
    InterviewProvider,
    useInterview,
    useJobApplication,
    companiesData,
} from "../../../lib";

const InterviewerContent = () => {
    const { state, getCurrentTask, updateCurrentCode, updateSubmission } =
        useInterview();
    const { markCompanyApplied } = useJobApplication();
    const searchParams = useSearchParams();
    const companyName = searchParams.get("company");
    const companyLogo = searchParams.get("logo") || "/logos/meta-logo.png";
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
    const [telemetryCreated, setTelemetryCreated] = useState(false);

    // Debug: Monitor interviewSessionId changes
    useEffect(() => {
        console.log("🔄 interviewSessionId changed to:", interviewSessionId);
    }, [interviewSessionId]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingPermissionGranted, setRecordingPermissionGranted] =
        useState(false);
    const [micPermissionGranted, setMicPermissionGranted] = useState(false);
    const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
    const [recordingUploaded, setRecordingUploaded] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const interviewSessionIdRef = useRef<string | null>(null); // Use ref to avoid stale closures
    const realTimeConversationRef = useRef<any>(null);
    const router = useRouter();

    // Require company name parameter
    useEffect(() => {
        if (!companyName) {
            router.push("/job-search");
        }
    }, [companyName, router]);

    const toggleMicMute = useCallback(() => {
        if (realTimeConversationRef.current?.toggleMicMute) {
            realTimeConversationRef.current.toggleMicMute();
        }
    }, []);

    // Function to upload recording to server and update database
    const uploadRecordingToServer = useCallback(
        async (blob: Blob) => {
            console.log(
                "🔍 uploadRecordingToServer called with sessionId:",
                interviewSessionIdRef.current,
                "uploaded:",
                recordingUploaded
            );

            if (!interviewSessionIdRef.current || recordingUploaded) {
                console.log(
                    "⏭️ Cannot upload: sessionId=",
                    interviewSessionIdRef.current,
                    "uploaded=",
                    recordingUploaded
                );
                return;
            }

            try {
                console.log("📤 Starting server upload process...");

                // Upload recording
                const formData = new FormData();
                formData.append(
                    "recording",
                    blob,
                    `interview-${interviewSessionIdRef.current}.mp4`
                );

                console.log(
                    "📤 Sending upload request to /api/interviews/session/screen-recording"
                );
                const uploadResponse = await fetch(
                    "/api/interviews/session/screen-recording",
                    {
                        method: "POST",
                        body: formData,
                    }
                );

                console.log(
                    "📤 Upload response status:",
                    uploadResponse.status
                );

                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text();
                    console.error("❌ Upload failed:", errorText);
                    throw new Error(
                        `Failed to upload recording: ${uploadResponse.status}`
                    );
                }

                const uploadData = await uploadResponse.json();
                console.log("✅ Recording uploaded:", uploadData.recordingUrl);

                // Update interview session with recording URL
                console.log(
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

                console.log(
                    "📤 Update response status:",
                    updateResponse.status
                );

                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    console.error("❌ Update failed:", errorText);
                    throw new Error(
                        `Failed to update interview session: ${updateResponse.status}`
                    );
                }

                const updateData = await updateResponse.json();
                console.log("✅ Interview session updated successfully");
                console.log("📋 Updated session data:", updateData);
                setRecordingUploaded(true);
            } catch (error) {
                console.error("❌ Error in uploadRecordingToServer:", error);
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
                console.log("🎥 Added video track:", track.label);
                combinedStream.addTrack(track);
            });

            // Add system audio track from display
            displayStream.getAudioTracks().forEach((track) => {
                console.log("🔊 Added system audio track:", track.label);
                combinedStream.addTrack(track);
            });

            // Add microphone audio track
            micStream.getAudioTracks().forEach((track) => {
                console.log("🎤 Added microphone audio track:", track.label);
                combinedStream.addTrack(track);
            });

            console.log(
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
                console.log("⚠️ H.264 not supported, trying basic mp4...");
                mimeType = "video/mp4";
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    console.log("⚠️ MP4 not supported, using default");
                    mimeType = "";
                }
            }

            console.log("🎥 Using mime type:", mimeType);

            const mediaRecorder = new MediaRecorder(
                combinedStream,
                mimeType ? { mimeType } : {}
            );

            mediaRecorderRef.current = mediaRecorder;
            recordedChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                console.log(
                    "📡 ondataavailable fired, data size:",
                    event.data.size
                );
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                    console.log(
                        "📊 Chunks array length:",
                        recordedChunksRef.current.length
                    );
                }
            };

            mediaRecorder.onstop = async () => {
                console.log(
                    "🛑 MediaRecorder stopped, processing recorded chunks..."
                );
                console.log(
                    "📊 Recorded chunks count:",
                    recordedChunksRef.current.length
                );

                if (recordedChunksRef.current.length === 0) {
                    console.log("❌ No recorded chunks available");
                    return;
                }

                const blob = new Blob(recordedChunksRef.current, {
                    type: "video/mp4",
                });

                console.log("📁 Created blob of size:", blob.size, "bytes");

                // Create object URL for the recording
                const url = URL.createObjectURL(blob);
                setRecordingUrl(url);

                // Store the blob for later upload (will be triggered by event handler)
                // Keep it as an array to maintain consistency
                recordedChunksRef.current = [blob];
                console.log("✅ Recording captured, ready for upload");

                // Auto-upload and update database when recording is ready
                console.log(
                    "🔍 onstop: interviewSessionId =",
                    interviewSessionIdRef.current,
                    "recordingUploaded =",
                    recordingUploaded
                );
                if (interviewSessionIdRef.current && !recordingUploaded) {
                    console.log(
                        "🚀 Auto-uploading recording for session:",
                        interviewSessionIdRef.current
                    );
                    await uploadRecordingToServer(blob);
                } else {
                    console.log(
                        "⏭️ Cannot auto-upload: sessionId=",
                        interviewSessionIdRef.current,
                        "uploaded=",
                        recordingUploaded
                    );
                }
            };

            // Add cleanup handlers for when recording stops
            combinedStream.getTracks().forEach((track) => {
                track.onended = () => {
                    console.log("🎵 Track ended:", track.kind, track.label);
                };
            });

            return true;
        } catch (error) {
            console.error("❌ Error requesting recording permission:", error);

            // Provide more specific error messages
            if (error instanceof Error) {
                if (error.name === "NotAllowedError") {
                    console.error(
                        "❌ Permission denied for screen recording or microphone"
                    );
                } else if (error.name === "NotFoundError") {
                    console.error("❌ No screen or microphone found");
                } else if (error.name === "NotReadableError") {
                    console.error("❌ Screen or microphone is already in use");
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
            if (!permissionGranted) return;
        }

        if (mediaRecorderRef.current && !isRecording) {
            recordedChunksRef.current = [];
            // Start recording with a timeslice to ensure periodic data collection
            mediaRecorderRef.current.start(1000); // Collect data every 1 second
            setIsRecording(true);
            console.log("✅ Screen recording started");
        }
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

            // Clean up MediaRecorder and chunks
            mediaRecorderRef.current = null;
            recordedChunksRef.current = [];

            console.log("✅ Screen recording stopped");
        }
    }, [isRecording]);

    // Event handler for inserting recording URL (called manually, not in useEffect)
    const insertRecordingUrl = useCallback(async () => {
        console.log("🚀 insertRecordingUrl called");
        console.log("📋 Current state:", {
            interviewSessionId,
            recordingUrl,
            recordingUploaded,
            recordedChunksLength: recordedChunksRef.current.length,
        });

        if (!interviewSessionId) {
            console.log("⏭️ No interview session ID available yet");
            return;
        }

        if (!recordingUrl) {
            console.log("⏭️ No recording available to upload");
            return;
        }

        if (recordingUploaded) {
            console.log("⏭️ Recording already uploaded");
            return;
        }

        // Get the stored blob from recordedChunksRef
        if (recordedChunksRef.current.length === 0) {
            console.log("⏭️ No recording blob available");
            return;
        }

        const blob = recordedChunksRef.current[0];
        if (!(blob instanceof Blob)) {
            console.log("⏭️ Invalid recording blob");
            return;
        }

        console.log("📁 Blob details:", {
            size: blob.size,
            type: blob.type,
        });

        console.log(
            "🚀 Event handler: Inserting recording URL for session:",
            interviewSessionId
        );

        try {
            console.log("📤 Starting upload process...");

            // Upload recording
            const formData = new FormData();
            formData.append(
                "recording",
                blob,
                `interview-${interviewSessionId}.mp4`
            );

            console.log(
                "📤 Sending upload request to /api/interviews/session/screen-recording"
            );
            const uploadResponse = await fetch(
                "/api/interviews/session/screen-recording",
                {
                    method: "POST",
                    body: formData,
                }
            );

            console.log("📤 Upload response status:", uploadResponse.status);

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                console.error("❌ Upload failed:", errorText);
                throw new Error(
                    `Failed to upload recording: ${uploadResponse.status}`
                );
            }

            const uploadData = await uploadResponse.json();
            console.log("✅ Recording uploaded:", uploadData.recordingUrl);

            // Update interview session with recording URL
            console.log(
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

            console.log("📤 Update response status:", updateResponse.status);

            if (!updateResponse.ok) {
                const errorText = await updateResponse.text();
                console.error("❌ Update failed:", errorText);
                throw new Error(
                    `Failed to update interview session: ${updateResponse.status}`
                );
            }

            const updateData = await updateResponse.json();
            console.log("✅ Interview session updated successfully");
            console.log("📋 Updated session data:", updateData);
            setRecordingUploaded(true);
        } catch (error) {
            console.error(
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

    const handleInterviewButtonClick = useCallback(
        async (action: "start" | "stop") => {
            if (action === "start") {
                try {
                    // Create application if it doesn't exist
                    if (!applicationCreated && companyName) {
                        console.log("🚀 Creating application for interview...");
                        const company = companiesData.find(
                            (c) => c.name === companyName
                        );
                        if (company) {
                            try {
                                const response = await fetch(
                                    "/api/applications/create",
                                    {
                                        method: "POST",
                                        headers: {
                                            "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                            companyId: company.id,
                                            jobTitle: "Frontend Developer",
                                        }),
                                    }
                                );

                                if (response.ok) {
                                    const data = await response.json();
                                    console.log(
                                        "✅ Application created for interview:",
                                        data.application.id
                                    );
                                    setApplicationCreated(true);

                                    // Now create interview session
                                    console.log(
                                        "🚀 Creating interview session..."
                                    );
                                    const sessionResponse = await fetch(
                                        "/api/interviews/session",
                                        {
                                            method: "POST",
                                            headers: {
                                                "Content-Type":
                                                    "application/json",
                                            },
                                            body: JSON.stringify({
                                                applicationId:
                                                    data.application.id,
                                                companyId: company.id,
                                            }),
                                        }
                                    );

                                    if (sessionResponse.ok) {
                                        const sessionData =
                                            await sessionResponse.json();
                                        console.log(
                                            "✅ Interview session created:",
                                            sessionData.interviewSession.id
                                        );
                                        console.log(
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
                    }

                    // Reset editor code to initial state for new interview
                    updateCurrentCode(getInitialCode());

                    // Clear chat panel before starting new interview
                    window.postMessage({ type: "clear-chat" }, "*");

                    // Start screen recording
                    await startRecording();

                    await realTimeConversationRef.current?.startConversation();
                    setIsInterviewActive(true);
                } catch (error) {
                    console.error("Failed to start interview:", error);
                }
            } else {
                try {
                    await realTimeConversationRef.current?.stopConversation();
                    await stopRecording();
                    setIsInterviewActive(false);
                    setIsAgentConnected(false);
                    setIsTimerRunning(false);
                    setIsCodingStarted(false);

                    // Clean up timer interval
                    if (timerInterval) {
                        clearInterval(timerInterval);
                        setTimerInterval(null);
                    }
                } catch (error) {
                    console.error("Failed to stop interview:", error);
                }
            }
        },
        [
            timerInterval,
            updateCurrentCode,
            applicationCreated,
            companyName,
            startRecording,
            stopRecording,
        ]
    );

    const handleStartCoding = async () => {
        setTimeLeft(30 * 60); // Reset to 30 minutes
        setIsTimerRunning(true);
        setIsCodingStarted(true);

        // Send is_coding status to ElevenLabs KB
        if (realTimeConversationRef.current) {
            const kb = {
                is_coding: true,
            };
            const text = `KB_UPDATE: ${JSON.stringify(kb)}`;
            try {
                await realTimeConversationRef.current.sendContextualUpdate(
                    text
                );
                console.log("✅ Coding status sent to ElevenLabs KB");
            } catch (error) {
                console.error(
                    "❌ Failed to send coding status to ElevenLabs KB:",
                    error
                );
            }
        }

        // Start timer only when user clicks
        const interval = setInterval(async () => {
            setTimeLeft((time) => {
                if (time <= 1) {
                    // Time's up - cleanup
                    setIsTimerRunning(false);
                    setIsCodingStarted(false);

                    // Send coding stopped status when time expires
                    if (realTimeConversationRef.current) {
                        const kb = {
                            is_coding: false,
                        };
                        const text = `KB_UPDATE: ${JSON.stringify(kb)}`;
                        realTimeConversationRef.current
                            .sendContextualUpdate(text)
                            .then(() =>
                                console.log(
                                    "✅ Timer expired - coding stopped status sent to ElevenLabs KB"
                                )
                            )
                            .catch((error: any) =>
                                console.error(
                                    "❌ Failed to send timer expired status to ElevenLabs KB:",
                                    error
                                )
                            );
                    }

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

        // Send is_coding status to ElevenLabs KB
        if (realTimeConversationRef.current) {
            const kb = {
                is_coding: false,
            };
            const text = `KB_UPDATE: ${JSON.stringify(kb)}`;
            try {
                await realTimeConversationRef.current.sendContextualUpdate(
                    text
                );
                console.log("✅ Coding stopped status sent to ElevenLabs KB");
            } catch (error) {
                console.error(
                    "❌ Failed to send coding stopped status to ElevenLabs KB:",
                    error
                );
            }
        }

        // Clear timer interval
        if (timerInterval) {
            clearInterval(timerInterval);
            setTimerInterval(null);
        }
    };

    // Separate function for telemetry creation - called only once
    const createInterviewTelemetry = useCallback(async () => {
        if (!interviewSessionId || telemetryCreated) {
            console.log(
                telemetryCreated
                    ? "⏭️ Telemetry already created"
                    : "⏭️ No session ID for telemetry"
            );
            return;
        }

        console.log(
            "🚀 Creating telemetry data for interview session:",
            interviewSessionId
        );

        try {
            const telemetryResponse = await fetch(
                "/api/interviews/session/telemetry",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        interviewSessionId: interviewSessionId,
                    }),
                }
            );

            if (telemetryResponse.ok) {
                const telemetryData = await telemetryResponse.json();
                console.log(
                    "✅ Telemetry data created:",
                    telemetryData.telemetryData.id
                );
                setTelemetryCreated(true);
            } else {
                console.error("❌ Failed to create telemetry data");
                // Log error details but don't throw
                try {
                    const errorData = await telemetryResponse.json();
                    console.error("❌ Error response details:", errorData);
                } catch (parseError) {
                    console.error(
                        "❌ Response status:",
                        telemetryResponse.status
                    );
                }
            }
        } catch (error: any) {
            console.error("❌ Error creating telemetry data:", error);
            console.error("❌ Error details:", {
                name: error?.name,
                message: error?.message,
                stack: error?.stack,
            });
        }
    }, [interviewSessionId, telemetryCreated]);

    const handleSubmit = async () => {
        try {
            // Update local state
            updateSubmission(state.currentCode);

            // Stop screen recording (upload will happen automatically in onstop handler)
            await stopRecording();

            // Send submission to ElevenLabs KB
            if (realTimeConversationRef.current) {
                const kb = {
                    submission: state.currentCode,
                    has_submitted: "true",
                    is_coding: false,
                };
                console.log("📤 has_submitted flag sent:", kb.has_submitted);
                const text = `KB_UPDATE: ${JSON.stringify(kb)}`;
                await realTimeConversationRef.current.sendContextualUpdate(
                    text
                );
                console.log("✅ Submission sent to ElevenLabs KB");

                // Send "I'm done" user message (special message, not shown in chat)
                const messageSent =
                    await realTimeConversationRef.current.sendUserMessage(
                        "I'm done"
                    );
                if (messageSent) {
                    console.log(
                        "✅ Special 'I'm done' message sent and received successfully"
                    );
                } else {
                    console.error("❌ Failed to send 'I'm done' message");
                }
            }

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
            if (interviewConcluded && companyName) {
                try {
                    // Find company by name to update local state
                    const company = companiesData.find(
                        (c) => c.name === companyName
                    );
                    if (company) {
                        // Update local state to mark company as applied
                        markCompanyApplied(company.id);
                    }

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
    }, [interviewConcluded, companyName, router, markCompanyApplied]);

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
                    Thank you for your time Noam
                </h1>
                <p className="text-xl text-gray-600 font-light">Good luck!</p>
            </div>
        </div>
    );

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
                        {/* Recording Indicator */}
                        {(isRecording || recordingPermissionGranted) && (
                            <div className="flex items-center space-x-2">
                                {/* Screen Recording Indicator */}
                                <div
                                    className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                                        isRecording
                                            ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                            : "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                    }`}
                                >
                                    {isRecording ? (
                                        <Video className="w-3 h-3" />
                                    ) : (
                                        <VideoOff className="w-3 h-3" />
                                    )}
                                    <span>REC</span>
                                </div>

                                {/* Microphone Indicator */}
                                {micPermissionGranted && (
                                    <div
                                        className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                                            isRecording
                                                ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                                : "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                        }`}
                                    >
                                        <div
                                            className={`w-2 h-2 rounded-full ${
                                                isRecording
                                                    ? "bg-red-500 animate-pulse"
                                                    : "bg-green-500"
                                            }`}
                                        ></div>
                                        <span>MIC</span>
                                    </div>
                                )}
                            </div>
                        )}

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
                        <button
                            onClick={() =>
                                handleInterviewButtonClick(
                                    isInterviewActive ? "stop" : "start"
                                )
                            }
                            className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 hover:shadow-sm ${
                                isInterviewActive
                                    ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20"
                                    : "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/10 dark:text-green-400 dark:hover:bg-green-900/20"
                            }`}
                            title={
                                isInterviewActive
                                    ? "Stop Interview"
                                    : "Start Interview"
                            }
                        >
                            {isInterviewActive
                                ? "Stop Interview"
                                : "Start Interview"}
                        </button>
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
                        <div className="h-full border-r bg-white border-light-gray dark:bg-gray-800 dark:border-gray-700">
                            <EditorPanel
                                showDiff={showDiff}
                                originalCode={originalCode}
                                modifiedCode={modifiedCode}
                                currentCode={state.currentCode}
                                onCodeChange={handleCodeChange}
                                onApplyChanges={handleApplyChanges}
                                onRejectChanges={handleRejectChanges}
                                isDarkMode={isDarkMode}
                                availableTabs={availableTabs}
                                activeTab={activeTab}
                                onTabSwitch={handleTabSwitch}
                                onRunCode={handleRunCode}
                                readOnly={!isCodingStarted}
                            />
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
                                        onStartConversation={() => {
                                            console.log("Conversation started");
                                            setIsAgentConnected(true);
                                        }}
                                        onEndConversation={() => {
                                            console.log("Conversation ended");
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
                                            // Create telemetry data once when interview concludes
                                            createInterviewTelemetry();
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
