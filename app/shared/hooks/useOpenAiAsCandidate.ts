"use client";

import { useCallback } from "react";
import {
    buildClientTools,
    registerClientTools,
} from "../../(features)/interview/components/chat/clientTools";

export type OpenAiCandidateHook = {
    handleUserTranscript: (transcript: string) => Promise<void>;
    getClientTools: (
        getCode: () => string,
        setCode: (code: string) => void
    ) => any;
    registerClientTools: (
        conversation: any,
        tools: any
    ) => Promise<boolean | void>;
};

export function useOpenAiAsCandidate(
    onSendUserMessage?: (message: string) => Promise<boolean>
): OpenAiCandidateHook {
    const handleUserTranscript = useCallback(
        async (transcript: string) => {
            await onSendUserMessage?.(transcript);
        },
        [onSendUserMessage]
    );

    const getClientTools = (
        getCode: () => string,
        setCode: (code: string) => void
    ) => buildClientTools(getCode, setCode);

    return {
        handleUserTranscript,
        getClientTools,
        registerClientTools,
    };
}
