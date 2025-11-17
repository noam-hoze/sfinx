import { useCallback, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { log } from "../../../../shared/services";

const logger = log;

export const useScreenRecording = (isDemoMode: boolean = false) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingPermissionGranted, setRecordingPermissionGranted] =
        useState(false);
    const [micPermissionGranted, setMicPermissionGranted] = useState(false);
    const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
    const [recordingUploaded, setRecordingUploaded] = useState(false);
    const [interviewSessionId, setInterviewSessionIdState] = useState<
        string | null
    >(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const selectedMimeTypeRef = useRef<string>("");
    const interviewSessionIdRef = useRef<string | null>(null);
    const actualRecordingStartTimeRef = useRef<Date | null>(null);

    const setInterviewSessionId = useCallback((sessionId: string | null) => {
        setInterviewSessionIdState(sessionId);
        interviewSessionIdRef.current = sessionId;
        setRecordingUploaded(false);
    }, []);

    // Allows developers to skip the screen sharing prompt during local debugging.
    // When NEXT_PUBLIC_SKIP_SCREEN_SHARE=true, we bypass requesting display/media permissions
    // and pretend permissions are granted so the interview can begin immediately.
    const skipScreenShare =
        process.env.NEXT_PUBLIC_SKIP_SCREEN_SHARE === "true";

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
                    "Cannot upload: sessionId=",
                    interviewSessionIdRef.current,
                    "uploaded=",
                    recordingUploaded
                );
                return;
            }

            try {
                logger.info("📤 Starting direct Blob upload...");
                logger.info("📁 Blob size:", blob.size, "bytes");

                const filename = `interview-${interviewSessionIdRef.current}.mp4`;

                // Direct client-side upload to Vercel Blob (bypasses API route size limits)
                const blobResult = await upload(filename, blob, {
                    access: "public",
                    handleUploadUrl: "/api/interviews/session/blob-upload-url",
                });

                const recordingUrl = blobResult.url;
                logger.info("✅ Recording uploaded to Blob:", recordingUrl);

                const updateUrl = isDemoMode 
                    ? `/api/interviews/session/${interviewSessionIdRef.current}?skip-auth=true`
                    : `/api/interviews/session/${interviewSessionIdRef.current}`;

                logger.info(
                    "📤 Sending update request to:",
                    updateUrl
                );
                const updateResponse = await fetch(
                    updateUrl,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            videoUrl: recordingUrl,
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

                await updateResponse.json();
                logger.info("✅ Interview session updated successfully");
                setRecordingUploaded(true);
            } catch (error) {
                logger.error("❌ Error in uploadRecordingToServer:", error);
            }
        },
        [recordingUploaded]
    );

    const requestRecordingPermission = useCallback(async () => {
        if (skipScreenShare) {
            logger.info(
                "Skipping screen share due to NEXT_PUBLIC_SKIP_SCREEN_SHARE"
            );
            setMicPermissionGranted(true);
            setRecordingPermissionGranted(true);
            return true;
        }
        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
            });

            const micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });

            const combinedStream = new MediaStream();

            displayStream.getVideoTracks().forEach((track) => {
                logger.info("🎥 Added video track:", track.label);
                combinedStream.addTrack(track);
            });

            displayStream.getAudioTracks().forEach((track) => {
                logger.info("🔊 Added system audio track:", track.label);
                combinedStream.addTrack(track);
            });

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

                const mimeType = selectedMimeTypeRef.current;
                if (!mimeType) {
                    throw new Error("selectedMimeTypeRef missing value");
                }
                const blob = new Blob(recordedChunksRef.current, {
                    type: mimeType,
                });

                logger.info("📁 Created blob of size:", blob.size, "bytes");

                const url = URL.createObjectURL(blob);
                setRecordingUrl(url);

                recordedChunksRef.current = [blob];
                logger.info("✅ Recording captured, ready for upload");

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
                        "Cannot auto-upload: sessionId=",
                        interviewSessionIdRef.current,
                        "uploaded=",
                        recordingUploaded
                    );
                }

                mediaRecorderRef.current = null;
                recordedChunksRef.current = [];
            };

            combinedStream.getTracks().forEach((track) => {
                track.onended = () => {
                    logger.info("🎵 Track ended:", track.kind, track.label);
                };
            });

            return true;
        } catch (error) {
            logger.error("❌ Error requesting recording permission:", error);

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
        if (skipScreenShare) {
            logger.info("startRecording: bypassing media capture (dev mode)");
            setRecordingPermissionGranted(true);
            setMicPermissionGranted(true);
            return true;
        }
        if (!recordingPermissionGranted || !mediaRecorderRef.current) {
            const permissionGranted = await requestRecordingPermission();
            if (!permissionGranted) {
                logger.info(
                    "Screen recording permission denied - not starting interview"
                );
                return false;
            }
        }

        if (mediaRecorderRef.current && !isRecording) {
            recordedChunksRef.current = [];
            const startTime = new Date();
            actualRecordingStartTimeRef.current = startTime;
            mediaRecorderRef.current.start();
            setIsRecording(true);
            logger.info("✅ Screen recording started at:", startTime.toISOString());
            return true;
        }

        return false;
    }, [isRecording, recordingPermissionGranted, requestRecordingPermission]);

    const stopRecording = useCallback(async () => {
        if (mediaRecorderRef.current && isRecording) {
            if (mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.requestData();
            }

            mediaRecorderRef.current.stop();
            setIsRecording(false);

            if (mediaRecorderRef.current.stream) {
                mediaRecorderRef.current.stream
                    .getTracks()
                    .forEach((track) => track.stop());
            }

            logger.info("✅ Screen recording stopped");
        }
    }, [isRecording]);

    const insertRecordingUrl = useCallback(async () => {
        logger.info("🚀 insertRecordingUrl called");
        logger.info("📋 Current state:", {
            interviewSessionId,
            recordingUrl,
            recordingUploaded,
            recordedChunksLength: recordedChunksRef.current.length,
        });

        if (!interviewSessionId) {
            logger.info("No interview session ID available yet");
            return;
        }

        if (!recordingUrl) {
            logger.info("No recording available to upload");
            return;
        }

        if (recordingUploaded) {
            logger.info("Recording already uploaded");
            return;
        }

        if (recordedChunksRef.current.length === 0) {
            logger.warn("No recording blob available");
            return;
        }

        const blob = recordedChunksRef.current[0];
        if (!(blob instanceof Blob)) {
            logger.warn("Invalid recording blob");
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
            logger.info("📤 Starting direct Blob upload...");
            logger.info("📁 Blob size:", blob.size, "bytes");

            const filename = `interview-${interviewSessionId}.mp4`;

            // Direct client-side upload to Vercel Blob (bypasses API route size limits)
            const blobResult = await upload(filename, blob, {
                access: "public",
                handleUploadUrl: "/api/interviews/session/blob-upload-url",
                allowOverwrite: true,
            });

            const recordingUrl = blobResult.url;
            logger.info("✅ Recording uploaded to Blob:", recordingUrl);

            const updateUrl = isDemoMode 
                ? `/api/interviews/session/${interviewSessionId}?skip-auth=true`
                : `/api/interviews/session/${interviewSessionId}`;

            logger.info(
                "📤 Sending update request to:",
                updateUrl,
                "isDemoMode:",
                isDemoMode,
                "videoUrl:",
                recordingUrl
            );
            const updateResponse = await fetch(
                updateUrl,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        videoUrl: recordingUrl,
                    }),
                }
            );

            logger.info("📤 Update response status:", updateResponse.status);

            if (!updateResponse.ok) {
                const errorText = await updateResponse.text();
                logger.error("❌ Update response text:", errorText);
                logger.error("❌ Update failed:", errorText);
                throw new Error(
                    `Failed to update interview session: ${updateResponse.status}`
                );
            }

            await updateResponse.json();
            logger.info("✅ Interview session updated successfully");
            setRecordingUploaded(true);
        } catch (error) {
            logger.error("❌ Error in insertRecordingUrl event handler:", error);
        }
    }, [interviewSessionId, recordingUploaded, recordingUrl]);

    const getActualRecordingStartTime = useCallback(() => {
        return actualRecordingStartTimeRef.current;
    }, []);

    return {
        isRecording,
        recordingPermissionGranted,
        micPermissionGranted,
        recordingUrl,
        recordingUploaded,
        interviewSessionId,
        setInterviewSessionId,
        startRecording,
        stopRecording,
        insertRecordingUrl,
        requestRecordingPermission,
        setRecordingPermissionGranted,
        setMicPermissionGranted,
        setRecordingUploaded,
        mediaRecorderRef,
        getActualRecordingStartTime,
    };
};
