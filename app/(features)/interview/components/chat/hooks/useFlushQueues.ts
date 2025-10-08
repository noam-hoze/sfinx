"use client";

import { useEffect } from "react";
import { logger } from "app/shared/services";

const log = logger.for("@useFlushQueues.ts");

export function useFlushQueues(params: {
    conversation: any;
    contextUpdates: string[];
    userMessages: string[];
    clearContextUpdates: () => void;
    clearUserMessages: () => void;
}) {
    const {
        conversation,
        contextUpdates,
        userMessages,
        clearContextUpdates,
        clearUserMessages,
    } = params;

    useEffect(() => {
        if (conversation.status !== "connected") return;

        if (contextUpdates.length > 0 && conversation.sendContextualUpdate) {
            (async () => {
                for (const text of contextUpdates) {
                    try {
                        await conversation.sendContextualUpdate(text);
                        log.info("✅ Flushed contextual update:", text);
                    } catch (error) {
                        log.error("❌ Failed contextual update:", error);
                    }
                }
                clearContextUpdates();
            })();
        }

        if (userMessages.length > 0) {
            (async () => {
                for (const msg of userMessages) {
                    try {
                        await conversation.sendUserMessage(msg);
                        log.info("✅ Flushed user message:", msg);
                    } catch (error) {
                        log.error("❌ Failed user message:", error);
                    }
                }
                clearUserMessages();
            })();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversation, conversation.status, contextUpdates, userMessages]);
}
