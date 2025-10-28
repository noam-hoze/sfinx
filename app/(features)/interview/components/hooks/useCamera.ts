import { useCallback, useEffect, useRef, useState } from "react";
import { log } from "../../../../shared/services";

const logger = log;

export const useCamera = () => {
    const [isCameraOn, setIsCameraOn] = useState(false);
    const selfVideoRef = useRef<HTMLVideoElement | null>(null);
    const cameraStreamRef = useRef<MediaStream | null>(null);
    const cameraHideTimeoutRef = useRef<number | null>(null);

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
            } catch (_) {
                // Ignore playback issues
            }
        }
    }, [isCameraOn]);

    useEffect(() => {
        startCamera();
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
