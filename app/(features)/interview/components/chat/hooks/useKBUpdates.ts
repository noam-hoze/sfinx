"use client";

import { useEffect, useRef } from "react";
import { logger } from "app/shared/services";

const log = logger.for("@useKBUpdates.ts");

export function useKBUpdates(params: {
    conversation: any;
    kbVariables?: any;
    currentCode: string;
    updateKBVariables?: (updates: any) => Promise<void>;
}) {
    const { conversation, kbVariables, currentCode, updateKBVariables } =
        params;
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSentCodeRef = useRef<string>("");

    useEffect(() => {
        if (conversation.status !== "connected") {
            return;
        }

        if (kbVariables?.has_submitted) {
            return;
        }

        if (lastSentCodeRef.current === currentCode) {
            return;
        }

        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }

        updateTimeoutRef.current = setTimeout(async () => {
            try {
                await updateKBVariables?.({
                    current_code_summary: currentCode,
                });
                lastSentCodeRef.current = currentCode;
                log.info("✅ Code summary KB_UPDATE sent via state machine");
            } catch (error) {
                log.error("❌ Code summary KB_UPDATE failed:", error);
            }
        }, 1500);

        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversation.status, currentCode, kbVariables?.has_submitted]);
}
