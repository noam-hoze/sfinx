"use client";

import { useMemo } from "react";
import { logger } from "app/shared/services";

const log = logger.for("@useTransportAdapter.ts");

export interface TransportAdapter {
    start: () => Promise<void>;
    stop: () => void;
    sendUserMessage: (text: string) => Promise<boolean>;
    sendContextualUpdate?: (text: string) => Promise<void>;
    setClientTools?: (tools: Record<string, any>) => void;
}

export function useTransportAdapter(
    engine: "elevenlabs" | "openai",
    deps: {
        conversation: any;
    }
) {
    return useMemo<TransportAdapter>(() => {
        if (engine === "openai") {
            // Text-only adapter that relies on upstream for posting AI text (handled elsewhere)
            return {
                start: async () => {
                    log.info("OpenAI transport: start (text-only)");
                },
                stop: () => {
                    log.info("OpenAI transport: stop");
                },
                sendUserMessage: async (_text: string) => {
                    // No-op by default; OpenAITextConversation handles HTTP roundtrips
                    return true;
                },
                setClientTools: () => {},
            };
        }
        // ElevenLabs transport delegates to SDK methods
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
    }, [engine, deps?.conversation]);
}
