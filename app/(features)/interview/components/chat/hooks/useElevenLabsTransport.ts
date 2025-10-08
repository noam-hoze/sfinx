"use client";

import { useMemo } from "react";
import { logger } from "app/shared/services";

const log = logger.for("@useElevenLabsTransport.ts");

export interface ElevenLabsTransportAdapter {
    start: () => Promise<void>;
    stop: () => void;
    sendUserMessage: (text: string) => Promise<boolean>;
    sendContextualUpdate?: (text: string) => Promise<void>;
    setClientTools?: (tools: Record<string, any>) => void;
}

export function useElevenLabsTransport(deps: { conversation: any }) {
    return useMemo<ElevenLabsTransportAdapter>(() => {
        return {
            start: async () => {
                log.info("ElevenLabs transport: started");
            },
            stop: () => {
                try {
                    deps.conversation?.endSession?.();
                } catch (_) {}
                log.info("ElevenLabs transport: stopped");
            },
            sendUserMessage: async (text: string) => {
                try {
                    if (deps.conversation?.status !== "connected") return false;
                    await deps.conversation.sendUserMessage(text);
                    return true;
                } catch (e) {
                    log.warn("sendUserMessage failed", e);
                    return false;
                }
            },
            setClientTools: (tools: Record<string, any>) => {
                const anyConv: any = deps.conversation;
                if (typeof anyConv?.setClientTools === "function")
                    anyConv.setClientTools(tools);
            },
        };
    }, [deps?.conversation]);
}


