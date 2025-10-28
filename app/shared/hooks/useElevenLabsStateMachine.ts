"use client";
/**
 * useElevenLabsStateMachine
 *
 * Purpose
 * - Minimal conduit between the app and ElevenLabs.
 * - Owns the Knowledge Base (KB) variables, emits KB_UPDATE messages,
 *   and on a rising edge of using_ai (false -> true) sends a hidden
 *   user message to prompt the interviewer to ask exactly one question.
 *
 * What it does
 * - Maintains kbVariables: { candidate_name, is_coding, using_ai, current_code_summary, has_submitted }.
 * - updateKBVariables: merges updates, sanitizes booleans, and sends KB_UPDATE.
 * - Rising edge handling: when using_ai flips to true, immediately sends one
 *   special user message (not shown in the chat panel).
 * - handleUserTranscript: forwards user speech only while coding (is_coding = true).
 * - setCodingState / handleSubmission: keeps the KB coherent with the coding flow.
 *
 * What it does NOT do
 * - No SYS tags, timers, or turn-counting.
 * - No metrics/fairness/evidence tracking.
 */

import { useState, useCallback, useEffect } from "react";
import { log } from "../services/logger";
const logger = log;
let hasSubmittedOnce = false;

/**
 * Builds a hidden instruction for the ElevenLabs interviewer when external AI usage is detected.
 * - Sent as a hidden user message (not shown in UI) to nudge a single follow-up question.
 * - Assumes ElevenLabs is the interviewer.
 *
 * Example
 *   await onSendUserMessage(instructAgentInCaseOfAIUsage("Refactored fetch logic"));
 */
const instructAgentInCaseOfAIUsage = (addedCode: any) => `
Don't answer this message in our voice conversation. It's just to inform you of something.
The candidate has just used external AI. Now your using_ai variable is
true. Ask the candidate one follow up question about: ${addedCode}. Then you have to wait for his answer. 
Ignore noise and any other non lingual messages.
After the user answers, you will reply with an acknowledgemet and that's it. You will not ask another followup question.
After that, you go back to listening. Don't say your closing line`;

/**
 * KBVariables: canonical context mirrored to ElevenLabs via KB_UPDATE.
 * All booleans are sanitized before sending.
 */
export interface KBVariables {
    candidate_name: string;
    is_coding: boolean;
    using_ai: boolean;
    current_code_summary: string;
    has_submitted: boolean;
    ai_added_code?: string;
}

/**
 * useElevenLabsStateMachine
 * @param onElevenLabsUpdate  Sends raw text updates (e.g. `KB_UPDATE: {...}`) to ElevenLabs
 * @param onSendUserMessage   Sends a hidden user message (not shown in chat panel)
 * @param candidateName       Initial candidate name (kept in sync if it changes)
 */
/**
 * React hook that coordinates KB variables and side-effects for an ElevenLabs interviewer.
 *
 * Usage
 * ```ts
 * const {
 *   kbVariables,
 *   updateKBVariables,
 *   handleUserTranscript,
 *   setCodingState,
 *   handleSubmission,
 * } = useElevenLabsStateMachine(onElevenLabsUpdate, onSendUserMessage, candidateName);
 *
 * // Start coding
 * await setCodingState(true);
 * // Update summary
 * await updateKBVariables({ current_code_summary: code });
 * // Handle user speech
 * await handleUserTranscript("How should I structure this?");
 * // Submit
 * await handleSubmission(code);
 * ```
 */
export const useElevenLabsStateMachine = (
    onElevenLabsUpdate?: (text: string) => Promise<void>,
    onSendUserMessage?: (message: string) => Promise<boolean>,
    candidateName: string = "Candidate"
) => {
    // KB Variables state
    const [kbVariables, setKBVariables] = useState<KBVariables>({
        candidate_name: candidateName,
        is_coding: false,
        using_ai: false,
        current_code_summary: "",
        has_submitted: false,
    });

    /**
     * updateKBVariables
     * - Merge partial updates into KB, sanitize, and emit a KB_UPDATE to ElevenLabs.
     * - Side effect: if using_ai transitions false -> true, send one hidden user message
     *   to nudge the interviewer to ask a single question about current_code_summary.
     */
    /**
     * Merge partial updates into KB, sanitize booleans, emit KB_UPDATE.
     * Also detects using_ai rising edge (false->true) and sends a one-off hidden message
     * instructing the interviewer to ask exactly one follow-up question, then resets using_ai.
     */
    const updateKBVariables = useCallback(
        async (updates: Partial<KBVariables>) => {
            const newKB = { ...kbVariables, ...updates };

            // Detect rising edge: using_ai false -> true
            const isUsingAIRisingEdge =
                kbVariables.using_ai === false &&
                Boolean(updates.using_ai) === true;

            // Ensure booleans are actual boolean values, not stringified
            const sanitizedKB = {
                candidate_name: newKB.candidate_name,
                is_coding: Boolean(newKB.is_coding),
                using_ai: Boolean(newKB.using_ai),
                current_code_summary: newKB.current_code_summary,
                has_submitted: Boolean(newKB.has_submitted),
            };

            setKBVariables(sanitizedKB);

            if (onElevenLabsUpdate) {
                try {
                    // Exclude has_submitted from outbound payloads
                    const kbForUpdate = {
                        candidate_name: sanitizedKB.candidate_name,
                        is_coding: sanitizedKB.is_coding,
                        using_ai: sanitizedKB.using_ai,
                        current_code_summary: sanitizedKB.current_code_summary,
                    };
                    const text = `KB_UPDATE: ${JSON.stringify(kbForUpdate)}`;
                    await onElevenLabsUpdate(text);
                    logger.info("✅ KB variables updated:", kbForUpdate);
                } catch (error) {
                    logger.error("❌ Failed to update KB variables:", error);
                }
            }

            // After successfully updating KB, send special user message (not shown in chat)
            if (isUsingAIRisingEdge && onSendUserMessage) {
                try {
                    const addedCode = (updates as any).ai_added_code || "";
                    await onSendUserMessage(
                        instructAgentInCaseOfAIUsage(addedCode)
                    );
                    logger.info(
                        "✅ SENT - Dynamic AI usage message with added code"
                    );

                    // Immediately reset using_ai to false and clear ai_added_code, return to default reactive mode
                    const resetKB = {
                        ...sanitizedKB,
                        using_ai: false,
                    };
                    setKBVariables(resetKB);
                    if (onElevenLabsUpdate) {
                        try {
                            await onElevenLabsUpdate(
                                `KB_UPDATE: ${JSON.stringify(resetKB)}`
                            );
                            logger.info(
                                "✅ KB variables reset to default reactive mode:",
                                resetKB
                            );
                        } catch (error) {
                            logger.error(
                                "❌ Failed to send reset KB_UPDATE:",
                                error
                            );
                        }
                    }
                } catch (err) {
                    logger.error(
                        "❌ WAS NOT SENT - Dynamic AI usage message with added code"
                    );
                }
            }
        },
        [kbVariables, onElevenLabsUpdate, onSendUserMessage]
    );

    /**
     * handleUserTranscript
     * - Minimal gate: only forwards transcripts while coding.
     */
    /**
     * Forwards user transcript to the agent only while coding.
     * Keeps the interviewer focused during coding, ignores outside of coding.
     */
    const handleUserTranscript = useCallback(
        async (transcript: string) => {
            logger.info("🎤 User transcript received:", transcript);

            // Always forward meaningful questions during coding
            if (kbVariables.is_coding) {
                logger.info("✅ Forwarding meaningful question during coding");
                await onSendUserMessage?.(transcript);
            }
        },
        [kbVariables.is_coding, onSendUserMessage]
    );

    /**
     * setCodingState
     * - Toggles coding phase and mirrors to ElevenLabs via KB_UPDATE.
     */
    /**
     * Toggles coding phase and mirrors to ElevenLabs via KB_UPDATE.
     *
     * Example
     *   await setCodingState(true); // enter coding
     *   await setCodingState(false); // exit coding
     */
    const setCodingState = useCallback(
        async (isCoding: boolean) => {
            await updateKBVariables({
                is_coding: isCoding,
            });
        },
        [updateKBVariables]
    );

    /**
     * handleSubmission
     * - Sends the final code summary, marks submission, and ends coding.
     */
    /**
     * Finalizes the code summary and ends coding (idempotent: only first call wins).
     *
     * Example
     *   await handleSubmission(finalCode);
     */
    const handleSubmission = useCallback(
        async (code: string) => {
            if (hasSubmittedOnce) return;
            hasSubmittedOnce = true;
            // Do not send has_submitted via KB; just finalize code summary and coding state
            await updateKBVariables({
                current_code_summary: code,
                is_coding: false,
            });
        },
        [updateKBVariables]
    );

    /**
     * Sync candidate name into ElevenLabs KB if the caller changes it.
     */
    /**
     * Keeps candidate name in sync with ElevenLabs KB when the caller updates it.
     */
    useEffect(() => {
        if (candidateName !== kbVariables.candidate_name) {
            updateKBVariables({ candidate_name: candidateName });
        }
    }, [candidateName, kbVariables.candidate_name, updateKBVariables]);

    return {
        // State
        kbVariables,

        // Actions
        updateKBVariables,
        handleUserTranscript,
        setCodingState,
        handleSubmission,
    };
};
