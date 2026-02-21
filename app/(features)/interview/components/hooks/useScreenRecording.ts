import { useCallback, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEW_UI;

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
    const actualRecordingStartTimeRef = useRef<Date | null>(null);
    // Resolves once onstop + uploadRecordingToServer have fully completed.
    // Used by stopRecording() so callers can await the upload.
    const uploadCompleteRef = useRef<(() => void) | null>(null);

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
            log.info(LOG_CATEGORY, 
                "🔍 uploadRecordingToServer called with sessionId:",
                interviewSessionIdRef.current,
                "uploaded:",
                recordingUploaded
            );

            if (!interviewSessionIdRef.current || recordingUploaded) {
                log.info(LOG_CATEGORY, 
                    "Cannot upload: sessionId=",
                    interviewSessionIdRef.current,
                    "uploaded=",
                    recordingUploaded
                );
                return;
            }

            try {
                log.info(LOG_CATEGORY, "📤 Starting direct Blob upload...");
                log.info(LOG_CATEGORY, "📁 Blob size:", blob.size, "bytes");

                const filename = `interview-${interviewSessionIdRef.current}.mp4`;

                // Direct client-side upload to Vercel Blob (bypasses API route size limits)
                const blobResult = await upload(filename, blob, {
                    access: "public",
                    handleUploadUrl: "/api/interviews/session/blob-upload-url",
                });

                const recordingUrl = blobResult.url;
                log.info(LOG_CATEGORY, "✅ Recording uploaded to Blob:", recordingUrl);

                const updateUrl = `/api/interviews/session/${interviewSessionIdRef.current}`;

                log.info(LOG_CATEGORY, 
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

                log.info(LOG_CATEGORY, "📤 Update response status:", updateResponse.status);

                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    log.error(LOG_CATEGORY, "❌ Update failed:", errorText);
                    throw new Error(
                        `Failed to update interview session: ${updateResponse.status}`
                    );
                }

                await updateResponse.json();
                log.info(LOG_CATEGORY, "✅ Interview session updated successfully");
                setRecordingUploaded(true);
            } catch (error) {
                log.error(LOG_CATEGORY, "❌ Error in uploadRecordingToServer:", error);
            }
        },
        [recordingUploaded]
    );

    const requestRecordingPermission = useCallback(async () => {
        if (skipScreenShare) {
            log.info(LOG_CATEGORY, 
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
                log.info(LOG_CATEGORY, "🎥 Added video track:", track.label);
                combinedStream.addTrack(track);
            });

            displayStream.getAudioTracks().forEach((track) => {
                log.info(LOG_CATEGORY, "🔊 Added system audio track:", track.label);
                combinedStream.addTrack(track);
            });

            micStream.getAudioTracks().forEach((track) => {
                log.info(LOG_CATEGORY, "🎤 Added microphone audio track:", track.label);
                combinedStream.addTrack(track);
            });

            log.info(LOG_CATEGORY, 
                "🎵 Combined stream tracks:",
                combinedStream
                    .getTracks()
                    .map((track) => `${track.kind}: ${track.label}`)
            );

            setMicPermissionGranted(true);
            setRecordingPermissionGranted(true);

            let mimeType = "video/mp4;codecs=avc1";
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                log.info(LOG_CATEGORY, "⚠️ H.264 not supported, trying basic mp4...");
                mimeType = "video/mp4";
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    log.info(LOG_CATEGORY, "⚠️ MP4 not supported, using default");
                    mimeType = "";
                }
            }

            log.info(LOG_CATEGORY, "🎥 Using mime type:", mimeType);

            const mediaRecorder = new MediaRecorder(
                combinedStream,
                mimeType ? { mimeType } : {}
            );

            mediaRecorderRef.current = mediaRecorder;
            recordedChunksRef.current = [];
            selectedMimeTypeRef.current = mimeType;

            mediaRecorder.ondataavailable = (event) => {
                log.info(LOG_CATEGORY, 
                    "📡 ondataavailable fired, data size:",
                    event.data.size
                );
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                    log.info(LOG_CATEGORY, 
                        "📊 Chunks array length:",
                        recordedChunksRef.current.length
                    );
                }
            };

            mediaRecorder.onstop = async () => {
                log.info(LOG_CATEGORY, 
                    "🛑 MediaRecorder stopped, processing recorded chunks..."
                );
                log.info(LOG_CATEGORY, 
                    "📊 Recorded chunks count:",
                    recordedChunksRef.current.length
                );

                if (recordedChunksRef.current.length === 0) {
                    log.warn(LOG_CATEGORY, "❌ No recorded chunks available");
                    return;
                }

                const mimeType = selectedMimeTypeRef.current;
                if (!mimeType) {
                    throw new Error("selectedMimeTypeRef missing value");
                }
                const blob = new Blob(recordedChunksRef.current, {
                    type: mimeType,
                });

                log.info(LOG_CATEGORY, "📁 Created blob of size:", blob.size, "bytes");

                const url = URL.createObjectURL(blob);
                setRecordingUrl(url);

                recordedChunksRef.current = [blob];
                log.info(LOG_CATEGORY, "✅ Recording captured, ready for upload");

                log.info(LOG_CATEGORY, 
                    "🔍 onstop: interviewSessionId =",
                    interviewSessionIdRef.current,
                    "recordingUploaded =",
                    recordingUploaded
                );
                try {
                    if (interviewSessionIdRef.current && !recordingUploaded) {
                        log.info(LOG_CATEGORY,
                            "🚀 Auto-uploading recording for session:",
                            interviewSessionIdRef.current
                        );
                        await uploadRecordingToServer(blob);
                    } else {
                        log.info(LOG_CATEGORY,
                            "Cannot auto-upload: sessionId=",
                            interviewSessionIdRef.current,
                            "uploaded=",
                            recordingUploaded
                        );
                    }
                } finally {
                    // Signal stopRecording() that the upload is done (success or fail).
                    uploadCompleteRef.current?.();
                    uploadCompleteRef.current = null;
                }

                mediaRecorderRef.current = null;
                recordedChunksRef.current = [];
            };

            combinedStream.getTracks().forEach((track) => {
                track.onended = () => {
                    log.info(LOG_CATEGORY, "🎵 Track ended:", track.kind, track.label);
                };
            });

            return true;
        } catch (error) {
            log.error(LOG_CATEGORY, "❌ Error requesting recording permission:", error);

            if (error instanceof Error) {
                if (error.name === "NotAllowedError") {
                    log.error(LOG_CATEGORY, 
                        "❌ Permission denied for screen recording or microphone"
                    );
                } else if (error.name === "NotFoundError") {
                    log.error(LOG_CATEGORY, "❌ No screen or microphone found");
                } else if (error.name === "NotReadableError") {
                    log.error(LOG_CATEGORY, "❌ Screen or microphone is already in use");
                }
            }

            setRecordingPermissionGranted(false);
            setMicPermissionGranted(false);
            return false;
        }
    }, [recordingUploaded, uploadRecordingToServer]);

    const startRecording = useCallback(async () => {
        if (skipScreenShare) {
            log.info(LOG_CATEGORY, "startRecording: bypassing media capture (dev mode)");
            setRecordingPermissionGranted(true);
            setMicPermissionGranted(true);
            return true;
        }
        if (!recordingPermissionGranted || !mediaRecorderRef.current) {
            const permissionGranted = await requestRecordingPermission();
            if (!permissionGranted) {
                log.info(LOG_CATEGORY, 
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
            log.info(LOG_CATEGORY, "✅ Screen recording started at:", startTime.toISOString());
            return true;
        }

        return false;
    }, [isRecording, recordingPermissionGranted, requestRecordingPermission]);

    const stopRecording = useCallback(async () => {
        if (!mediaRecorderRef.current) return;

        if (mediaRecorderRef.current.state === "recording") {
            // Register the resolver BEFORE calling stop() so onstop always
            // finds it set, regardless of how quickly the event fires.
            const uploadDone = new Promise<void>((resolve) => {
                uploadCompleteRef.current = resolve;
            });

            mediaRecorderRef.current.requestData();
            mediaRecorderRef.current.stop();

            setIsRecording(false);

            if (mediaRecorderRef.current.stream) {
                mediaRecorderRef.current.stream
                    .getTracks()
                    .forEach((track) => track.stop());
            }

            log.info(LOG_CATEGORY, "✅ Screen recording stopped, waiting for upload…");

            // Wait for onstop + uploadRecordingToServer to finish so the caller
            // can be confident that videoUrl is in the DB before proceeding.
            await uploadDone;

            log.info(LOG_CATEGORY, "✅ Recording upload complete");
        } else {
            setIsRecording(false);

            if (mediaRecorderRef.current.stream) {
                mediaRecorderRef.current.stream
                    .getTracks()
                    .forEach((track) => track.stop());
            }

            log.info(LOG_CATEGORY, "✅ Screen recording stopped (was not recording)");
        }
    }, []);

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
        requestRecordingPermission,
        setRecordingPermissionGranted,
        setMicPermissionGranted,
        setRecordingUploaded,
        mediaRecorderRef,
        getActualRecordingStartTime,
    };
};
