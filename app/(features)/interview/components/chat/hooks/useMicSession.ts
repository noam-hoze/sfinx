"use client";

import { useCallback, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import { logger } from "app/shared/services";

const log = logger.for("@useMicSession.ts");

type MicSessionCallbacks = {
    micMuted: boolean;
    onConnect?: () => void;
    onDisconnect?: (event?: any) => void;
    onMessage?: (message: any) => void;
    onError?: (error: any) => void;
};

export function useMicSession({
    micMuted,
    onConnect,
    onDisconnect,
    onMessage,
    onError,
}: MicSessionCallbacks) {
    const micStreamRef = useRef<MediaStream | null>(null);

    const conversation = useConversation({
        micMuted,
        onConnect,
        onDisconnect,
        onMessage,
        onError,
    });

    const requestMic = useCallback(async () => {
        log.info("MicSession: requesting audio permissions");
        const micStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        micStreamRef.current = micStream;
        log.info("MicSession: audio permissions granted");
        return micStream;
    }, []);

    const stopMic = useCallback(() => {
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach((t) => t.stop());
            micStreamRef.current = null;
        }
    }, []);

    return {
        conversation,
        requestMic,
        stopMic,
        micStreamRef,
    };
}
