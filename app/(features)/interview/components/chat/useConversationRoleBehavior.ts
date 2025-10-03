import { useMemo } from "react";
import type { RoleConfig } from "../../../../shared/contexts/types";

export interface RoleBehavior {
    normalizeTriggerText: (text: string) => string;
    shouldAutoStartFromMessage: (args: {
        text: string;
        source: "ai" | "user";
    }) => boolean;
    isClosingLine: (text: string) => boolean;
}

/**
 * Strategy hook to encapsulate role-dependent behavior for conversation.
 */
export function useConversationRoleBehavior(
    roles: RoleConfig,
    automaticMode: boolean
): RoleBehavior {
    return useMemo(() => {
        const normalizeTriggerText = (text: string) =>
            text
                .toLowerCase()
                .replace(/[`'".,!?]/g, "")
                .replace(/\s+/g, " ")
                .trim();

        const triggerPhrases = ["lets start"];

        const shouldAutoStartFromMessage = ({
            text,
            source,
        }: {
            text: string;
            source: "ai" | "user";
        }) => {
            if (!automaticMode) return false;
            const normalized = normalizeTriggerText(text);
            const hasTrigger = triggerPhrases.some((p) =>
                normalized.includes(p)
            );
            if (!hasTrigger) return false;
            if (roles.interviewer === "elevenLabs") {
                return source === "ai"; // AI interviewer triggers
            }
            // Human interviewer triggers via user speech
            return source === "user";
        };

        const isClosingLine = (text: string) => {
            if (roles.interviewer !== "elevenLabs") return false;
            return normalizeTriggerText(text).includes(
                "the next steps will be shared with you shortly"
            );
        };

        return {
            normalizeTriggerText,
            shouldAutoStartFromMessage,
            isClosingLine,
        };
    }, [roles, automaticMode]);
}
