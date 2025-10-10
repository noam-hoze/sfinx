import { useCallback, useRef, useState } from "react";
import { logger } from "../../../../shared/services";

const log = logger.for("@InterviewIDE/useScreenRecording");

export const useScreenRecording = () => {
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

                await updateResponse.json();
                log.info("✅ Interview session updated successfully");
                setRecordingUploaded(true);
            } catch (error) {
                log.error("❌ Error in uploadRecordingToServer:", error);
            }
        },
        [recordingUploaded]
    );

    const requestRecordingPermission = useCallback(async () => {
        if (skipScreenShare) {
            log.info(
                "⏭️ Skipping screen share due to NEXT_PUBLIC_SKIP_SCREEN_SHARE"
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
                log.info("🎥 Added video track:", track.label);
                combinedStream.addTrack(track);
            });

            displayStream.getAudioTracks().forEach((track) => {
                log.info("🔊 Added system audio track:", track.label);
                combinedStream.addTrack(track);
            });

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

                const url = URL.createObjectURL(blob);
                setRecordingUrl(url);

                recordedChunksRef.current = [blob];
                log.info("✅ Recording captured, ready for upload");

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

                mediaRecorderRef.current = null;
                recordedChunksRef.current = [];
            };

            combinedStream.getTracks().forEach((track) => {
                track.onended = () => {
                    log.info("🎵 Track ended:", track.kind, track.label);
                };
            });

            return true;
        } catch (error) {
            log.error("❌ Error requesting recording permission:", error);

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
        if (skipScreenShare) {
            log.info("⏭️ startRecording: bypassing media capture (dev mode)");
            setRecordingPermissionGranted(true);
            setMicPermissionGranted(true);
            return true;
        }
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
            mediaRecorderRef.current.start();
            setIsRecording(true);
            log.info("✅ Screen recording started");
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

            log.info("✅ Screen recording stopped");
        }
    }, [isRecording]);

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

            await updateResponse.json();
            log.info("✅ Interview session updated successfully");
            setRecordingUploaded(true);
        } catch (error) {
            log.error("❌ Error in insertRecordingUrl event handler:", error);
        }
    }, [interviewSessionId, recordingUploaded, recordingUrl]);

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
    };
};
