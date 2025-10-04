"use client";
/**
 * useElevenLabsAsCandidate
 * Placeholder hook for ElevenLabs acting as the candidate.
 * Mirrors the interviewer API but omits interviewer-only behaviors (e.g., AI-usage prompt).
 */
import { useState, useCallback, useEffect } from "react";
import {
    buildClientTools,
    registerClientTools,
} from "../../(features)/interview/components/chat/clientTools";
import type { KBVariables } from "./useElevenLabsAsInterviewer";

export const useElevenLabsAsCandidate = (
    onElevenLabsUpdate?: (text: string) => Promise<void>,
    onSendUserMessage?: (message: string) => Promise<boolean>,
    candidateName: string = "Candidate"
) => {
    const [kbVariables, setKBVariables] = useState<KBVariables>({
        candidate_name: candidateName,
        is_coding: false,
        using_ai: false,
        current_code_summary: "",
        has_submitted: false,
    });

    const updateKBVariables = useCallback(
        async (updates: Partial<KBVariables>) => {
            const sanitized = {
                candidate_name:
                    updates.candidate_name ?? kbVariables.candidate_name,
                is_coding: Boolean(updates.is_coding ?? kbVariables.is_coding),
                using_ai: Boolean(updates.using_ai ?? kbVariables.using_ai),
                current_code_summary:
                    updates.current_code_summary ??
                    kbVariables.current_code_summary,
                has_submitted: Boolean(
                    updates.has_submitted ?? kbVariables.has_submitted
                ),
            } as KBVariables;
            setKBVariables(sanitized);
            // Candidate mode: no KB_UPDATE emissions
        },
        [kbVariables, onElevenLabsUpdate]
    );

    const handleUserTranscript = useCallback(
        async (transcript: string) => {
            // Candidate mode: generally echo important prompts as needed; keep minimal for now
            await onSendUserMessage?.(transcript);
        },
        [onSendUserMessage]
    );

    const setCodingState = useCallback(
        async (isCoding: boolean) => {
            await updateKBVariables({ is_coding: isCoding });
        },
        [updateKBVariables]
    );

    const handleSubmission = useCallback(
        async (code: string) => {
            await updateKBVariables({
                current_code_summary: code,
                is_coding: false,
            });
        },
        [updateKBVariables]
    );

    useEffect(() => {
        if (candidateName !== kbVariables.candidate_name) {
            updateKBVariables({ candidate_name: candidateName });
        }
    }, [candidateName, kbVariables.candidate_name, updateKBVariables]);

    const getClientTools = (
        getCode: () => string,
        setCode: (code: string) => void
    ) => buildClientTools(getCode, setCode);

    return {
        kbVariables,
        updateKBVariables,
        handleUserTranscript,
        setCodingState,
        handleSubmission,
        getClientTools,
        registerClientTools,
    };
};
