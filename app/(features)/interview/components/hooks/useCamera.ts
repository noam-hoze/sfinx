import { useCallback, useEffect, useRef, useState } from "react";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEW_UI;
const CAMERA_AUTO_START = process.env.NEXT_PUBLIC_CAMERA_AUTO_START !== "false";

export const useCamera = () => {
    log.info(LOG_CATEGORY, "🎬 useCamera hook initialized");
    const [isCameraOn, setIsCameraOn] = useState(false);
    const selfVideoRef = useRef<HTMLVideoElement | null>(null);
    const cameraStreamRef = useRef<MediaStream | null>(null);
    const cameraHideTimeoutRef = useRef<number | null>(null);

    const startCamera = useCallback(async () => {
        try {
            log.info(LOG_CATEGORY, "📹 Requesting camera permissions...");
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240, facingMode: "user" },
                audio: false,
            });
            log.info(LOG_CATEGORY, "📹 Camera stream acquired successfully");
            cameraStreamRef.current = stream;
            setIsCameraOn(true);
        } catch (error) {
            log.error(LOG_CATEGORY, "❌ Failed to start camera:", error);
            setIsCameraOn(false);
        }
    }, []);

    const stopCamera = useCallback(() => {
        setIsCameraOn(false);
        if (cameraHideTimeoutRef.current) {
            window.clearTimeout(cameraHideTimeoutRef.current);
        }

        // TODO: [Bug] This timeout's ID is stored in cameraHideTimeoutRef.current, but the cleanup function in the
        //        useEffect below (lines 84–88) only clears the timeout when the component unmounts — it does NOT
        //        clear a timeout that was set after the last unmount cleanup registered. If stopCamera() is called
        //        just before unmount and the component unmounts before the 350ms fires, the callback will attempt to
        //        access cameraStreamRef and selfVideoRef on an unmounted component. Store the timeout ID and always
        //        clear it in the cleanup, or use a mounted flag to guard the callback.
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

    const toggleCamera = useCallback(() => {
        if (isCameraOn) {
            stopCamera();
        } else {
            startCamera();
        }
    }, [isCameraOn, startCamera, stopCamera]);

    useEffect(() => {
        log.info(LOG_CATEGORY, "📹 Attach effect triggered", { isCameraOn, hasVideoRef: !!selfVideoRef.current, hasStream: !!cameraStreamRef.current });
        if (isCameraOn && selfVideoRef.current && cameraStreamRef.current) {
            try {
                log.info(LOG_CATEGORY, "📹 Attaching stream to video element");
                // @ts-ignore - srcObject is supported at runtime
                selfVideoRef.current.srcObject = cameraStreamRef.current;
                selfVideoRef.current.muted = true;
                // @ts-ignore - playsInline exists at runtime
                selfVideoRef.current.playsInline = true;
                const playPromise = selfVideoRef.current.play();
                if (playPromise && typeof playPromise.then === "function") {
                    playPromise.catch(() => {});
                }
                log.info(LOG_CATEGORY, "📹 Stream attached and playing");
            } catch (err) {
                log.error(LOG_CATEGORY, "📹 Failed to attach stream:", err);
            }
        }
    // TODO: [Bug] selfVideoRef.current should not be in this useEffect dependency array. Refs are mutable objects —
    //        changing .current does not trigger a re-render, so React will not re-run this effect when the video
    //        element mounts. The stream can be attached when isCameraOn=true but selfVideoRef.current is still null,
    //        and the effect won't re-run when the element later becomes available. Use a callback ref or a separate
    //        state variable to track when the video element is ready.
    }, [isCameraOn, selfVideoRef.current]);

    useEffect(() => {
        log.info(LOG_CATEGORY, "🎬 Auto-start effect running, CAMERA_AUTO_START:", CAMERA_AUTO_START);
        if (CAMERA_AUTO_START) {
            log.info(LOG_CATEGORY, "🎬 Starting camera automatically");
            startCamera();
        }
        return () => {
            stopCamera();
            if (cameraHideTimeoutRef.current) {
                window.clearTimeout(cameraHideTimeoutRef.current);
            }
        };
    }, [startCamera, stopCamera]);

    return {
        isCameraOn,
        selfVideoRef,
        startCamera,
        stopCamera,
        toggleCamera,
    };
};
