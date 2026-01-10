import { useCallback, useEffect, useRef, useState } from "react";
import { log } from "../../../../shared/services";

const logger = log;
const CAMERA_AUTO_START = process.env.NEXT_PUBLIC_CAMERA_AUTO_START !== "false";

export const useCamera = () => {
    logger.info("🎬 useCamera hook initialized");
    const [isCameraOn, setIsCameraOn] = useState(false);
    const selfVideoRef = useRef<HTMLVideoElement | null>(null);
    const cameraStreamRef = useRef<MediaStream | null>(null);
    const cameraHideTimeoutRef = useRef<number | null>(null);

    const startCamera = useCallback(async () => {
        try {
            logger.info("📹 Requesting camera permissions...");
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240, facingMode: "user" },
                audio: false,
            });
            logger.info("📹 Camera stream acquired successfully");
            cameraStreamRef.current = stream;
            setIsCameraOn(true);
        } catch (error) {
            logger.error("❌ Failed to start camera:", error);
            setIsCameraOn(false);
        }
    }, []);

    const stopCamera = useCallback(() => {
        setIsCameraOn(false);
        if (cameraHideTimeoutRef.current) {
            window.clearTimeout(cameraHideTimeoutRef.current);
        }

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
        logger.info("📹 Attach effect triggered", { isCameraOn, hasVideoRef: !!selfVideoRef.current, hasStream: !!cameraStreamRef.current });
        if (isCameraOn && selfVideoRef.current && cameraStreamRef.current) {
            try {
                logger.info("📹 Attaching stream to video element");
                // @ts-ignore - srcObject is supported at runtime
                selfVideoRef.current.srcObject = cameraStreamRef.current;
                selfVideoRef.current.muted = true;
                // @ts-ignore - playsInline exists at runtime
                selfVideoRef.current.playsInline = true;
                const playPromise = selfVideoRef.current.play();
                if (playPromise && typeof playPromise.then === "function") {
                    playPromise.catch(() => {});
                }
                logger.info("📹 Stream attached and playing");
            } catch (err) {
                logger.error("📹 Failed to attach stream:", err);
            }
        }
    }, [isCameraOn, selfVideoRef.current]);

    useEffect(() => {
        logger.info("🎬 Auto-start effect running, CAMERA_AUTO_START:", CAMERA_AUTO_START);
        if (CAMERA_AUTO_START) {
            logger.info("🎬 Starting camera automatically");
            startCamera();
        }
        return () => {
            stopCamera();
            if (cameraHideTimeoutRef.current) {
                window.clearTimeout(cameraHideTimeoutRef.current);
            }
        };
    }, []);

    return {
        isCameraOn,
        selfVideoRef,
        startCamera,
        stopCamera,
        toggleCamera,
    };
};
