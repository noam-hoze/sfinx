"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface KBVariables {
    candidate_name: string;
    is_coding: boolean;
    using_ai: boolean;
    current_code_summary: string;
    has_submitted: boolean;
}

export interface StateMachineState {
    ai_session_active: boolean;
    ai_turns: number;
    user_turns: number;
    silence_timer_active: boolean;
    session_timer_active: boolean;
    session_start_time: number;
}

export interface TimerConfig {
    silence_timeout: number; // Default 7 seconds
    session_timeout: number; // Default 120 seconds
    max_ai_turns: number; // Default 2
    max_user_turns: number; // Default 2
}

export const useElevenLabsStateMachine = (
    onElevenLabsUpdate?: (text: string) => Promise<void>,
    onSendUserMessage?: (message: string) => Promise<boolean>,
    candidateName: string = "Candidate"
) => {
    // Default timer configuration
    const timerConfig: TimerConfig = {
        silence_timeout: 7000, // 7 seconds
        session_timeout: 120000, // 120 seconds
        max_ai_turns: 2,
        max_user_turns: 2,
    };

    // State machine state
    const [state, setState] = useState<StateMachineState>({
        ai_session_active: false,
        ai_turns: 0,
        user_turns: 0,
        silence_timer_active: false,
        session_timer_active: false,
        session_start_time: 0,
    });

    // Ref to mirror ai_session_active for timer callbacks (avoids closure trap)
    const aiSessionActiveRef = useRef(false);
    useEffect(() => {
        aiSessionActiveRef.current = state.ai_session_active;
    }, [state.ai_session_active]);

    // KB Variables state
    const [kbVariables, setKBVariables] = useState<KBVariables>({
        candidate_name: candidateName,
        is_coding: false,
        using_ai: false,
        current_code_summary: "",
        has_submitted: false,
    });

    // Timer refs
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Update KB variables and send to ElevenLabs
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
                    const text = `KB_UPDATE: ${JSON.stringify(sanitizedKB)}`;
                    await onElevenLabsUpdate(text);
                    console.log("✅ KB variables updated:", sanitizedKB);
                } catch (error) {
                    console.error("❌ Failed to update KB variables:", error);
                }
            }

            // After successfully updating KB, send special user message (not shown in chat)
            if (isUsingAIRisingEdge && onSendUserMessage) {
                try {
                    await onSendUserMessage(
                        "I just used external AI. Now your using_ai variable is true, so you should ask me only one question about the current_code_summary. Let's have a conversation about your question afterwards."
                    );
                    console.log(
                        "SENT - I just used external AI. Now your using_ai variable is true, so you should ask me only one question about the current_code_summary. Let's have a conversation about your question afterwards."
                    );
                } catch (err) {
                    console.error(
                        "❌ WAS NOT SENT - I just used external AI. Now your using_ai variable is true, so you should ask me only one question about the current_code_summary. Let's have a conversation about your question afterwards. userAI-usage notification message failed to send:"
                    );
                }
            }
        },
        [kbVariables, onElevenLabsUpdate]
    );

    // Start silence timer
    const startSilenceTimer = useCallback(() => {
        console.log("⏰ Starting silence timer");

        // Clear existing timer
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
        }

        setState((prev) => ({ ...prev, silence_timer_active: true }));

        silenceTimerRef.current = setTimeout(async () => {
            console.log("🚨 Silence timeout reached - injecting [[SYS:WRAP]]");

            setState((prev) => ({ ...prev, silence_timer_active: false }));

            // Only inject wrap if session is still active (use ref to avoid closure trap)
            if (aiSessionActiveRef.current) {
                await injectSilentMessage("[[SYS:WRAP]]");
            }
        }, timerConfig.silence_timeout);
    }, [timerConfig.silence_timeout]);

    // Start session timer
    const startSessionTimer = useCallback(() => {
        console.log("⏰ Starting session timer");

        // Clear existing timer
        if (sessionTimerRef.current) {
            clearTimeout(sessionTimerRef.current);
        }

        setState((prev) => ({
            ...prev,
            session_timer_active: true,
            session_start_time: Date.now(),
        }));

        sessionTimerRef.current = setTimeout(async () => {
            console.log("🚨 Session timeout reached - injecting [[SYS:WRAP]]");

            setState((prev) => ({ ...prev, session_timer_active: false }));

            // Only inject wrap if session is still active (use ref to avoid closure trap)
            if (aiSessionActiveRef.current) {
                await injectSilentMessage("[[SYS:WRAP]]");
            }
        }, timerConfig.session_timeout);
    }, [timerConfig.session_timeout]);

    // Inject silent message to ElevenLabs
    const injectSilentMessage = useCallback(
        async (tag: string) => {
            if (onSendUserMessage) {
                console.log("📤 Injecting silent message:", tag);
                await onSendUserMessage(tag);
            }
        },
        [onSendUserMessage]
    );

    // Handle SYS tags from AI responses
    const handleSYSTag = useCallback(
        async (tag: string, aiMessage: string) => {
            console.log("🎯 SYS Tag detected:", tag);

            switch (tag) {
                case "[[SYS:ARM_SILENCE_TIMER]]":
                    startSilenceTimer();
                    break;

                case "[[SYS:ARM_SESSION_TIMER]]":
                    console.log(
                        "⏰ Session timer armed - activating AI session"
                    );
                    setState((prev) => ({ ...prev, ai_session_active: true }));
                    startSessionTimer();
                    break;

                case "[[SYS:WRAP]]":
                    console.log("🔄 SYS:WRAP received - closing session");

                    // Reset using_ai and session state
                    await updateKBVariables({ using_ai: false });
                    setState((prev) => ({
                        ...prev,
                        ai_session_active: false,
                        ai_turns: 0,
                        user_turns: 0,
                        silence_timer_active: false,
                        session_timer_active: false,
                    }));

                    // Clear timers
                    if (silenceTimerRef.current) {
                        clearTimeout(silenceTimerRef.current);
                        silenceTimerRef.current = null;
                    }
                    if (sessionTimerRef.current) {
                        clearTimeout(sessionTimerRef.current);
                        sessionTimerRef.current = null;
                    }

                    console.log(
                        "✅ AI usage session closed, returned to Silent Mode"
                    );
                    break;

                default:
                    console.warn("⚠️ Unknown SYS tag:", tag);
            }
        },
        [startSilenceTimer, startSessionTimer, updateKBVariables]
    );

    // Process AI message for SYS tags
    const processAIMessage = useCallback(
        async (message: string) => {
            const sysTagPattern = /\[\[SYS:[^\]]+\]\]/g;
            const sysTags = message.match(sysTagPattern);

            if (sysTags) {
                // Process each SYS tag
                for (const tag of sysTags) {
                    await handleSYSTag(tag, message);
                }

                // Strip SYS tags from the message before returning
                const cleanMessage = message.replace(sysTagPattern, "").trim();
                return cleanMessage;
            }

            return message;
        },
        [handleSYSTag]
    );

    // Handle user transcript
    const handleUserTranscript = useCallback(
        async (transcript: string) => {
            console.log("🎤 User transcript received:", transcript);

            // Skip if transcript is non-semantic (punctuation, fillers, etc.)
            if (isNonSemanticTranscript(transcript)) {
                console.log("🔇 Skipping non-semantic transcript");
                return;
            }

            // Track timing for session management
            const now = Date.now();

            // Clear silence timer since we have user input
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
                setState((prev) => ({ ...prev, silence_timer_active: false }));
            }

            // Always forward meaningful questions during coding
            if (
                kbVariables.is_coding &&
                isDirectMeaningfulQuestion(transcript)
            ) {
                console.log("✅ Forwarding meaningful question during coding");
                await onSendUserMessage?.(transcript);
            } else if (state.ai_session_active) {
                // Check if transcript is semantically meaningful (not just "ok", "yes", etc.)
                const isSemantic =
                    transcript.trim().split(/\s+/).length >= 4 ||
                    transcript.trim().length >= 20; // Or at least 20 characters

                if (isSemantic) {
                    // In AI Usage Session - forward normally and increment counter
                    setState((prev) => {
                        const newUserTurns = prev.user_turns + 1;

                        // Check turn cap (only if session still active)
                        if (
                            newUserTurns >= timerConfig.max_user_turns &&
                            aiSessionActiveRef.current
                        ) {
                            console.log(
                                "🚨 User turn cap reached - injecting [[SYS:WRAP]]"
                            );
                            injectSilentMessage("[[SYS:WRAP]]");
                        }

                        return { ...prev, user_turns: newUserTurns };
                    });
                } else {
                    console.log(
                        "🔇 Skipping short/insemantic user turn:",
                        transcript
                    );
                }

                await onSendUserMessage?.(transcript);
            }
        },
        [
            kbVariables.is_coding,
            state.ai_session_active,
            timerConfig.max_user_turns,
            onSendUserMessage,
            injectSilentMessage,
        ]
    );

    // Check if transcript is non-semantic
    const isNonSemanticTranscript = useCallback(
        (transcript: string): boolean => {
            const cleanTranscript = transcript.trim().toLowerCase();

            // Skip if too short
            if (cleanTranscript.length < 2) return true;

            // Skip punctuation only
            if (/^[.!?,\s]*$/.test(cleanTranscript)) return true;

            // Skip common fillers
            const fillers = [
                "um",
                "uh",
                "like",
                "you know",
                "so",
                "well",
                "hmm",
            ];
            if (fillers.includes(cleanTranscript)) return true;

            // Skip ellipses
            if (/^\.{3,}$/.test(cleanTranscript)) return true;

            return false;
        },
        []
    );

    // Check if transcript is a direct meaningful question
    const isDirectMeaningfulQuestion = useCallback(
        (transcript: string): boolean => {
            const cleanTranscript = transcript.trim().toLowerCase();

            // Must contain question words or end with question mark
            const hasQuestionWord =
                /\b(what|how|why|when|where|who|which|can|could|should|would|do|does|did|is|are|was|were)\b/.test(
                    cleanTranscript
                );
            const endsWithQuestionMark = cleanTranscript.endsWith("?");

            // Must be longer than a simple acknowledgment
            const isSubstantial = cleanTranscript.length > 10;

            return (hasQuestionWord || endsWithQuestionMark) && isSubstantial;
        },
        []
    );

    // Handle coding state changes
    const setCodingState = useCallback(
        async (isCoding: boolean) => {
            await updateKBVariables({
                is_coding: isCoding,
            });

            if (!isCoding) {
                // Reset session state when stopping coding
                setState((prev) => ({
                    ...prev,
                    ai_session_active: false,
                    ai_turns: 0,
                    user_turns: 0,
                    silence_timer_active: false,
                    session_timer_active: false,
                }));

                // Clear timers
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                }
                if (sessionTimerRef.current) {
                    clearTimeout(sessionTimerRef.current);
                }
            }
        },
        [updateKBVariables]
    );

    // Handle submission
    const handleSubmission = useCallback(
        async (code: string) => {
            await updateKBVariables({
                current_code_summary: code,
                has_submitted: true,
                is_coding: false,
            });

            // Reset session state
            setState((prev) => ({
                ...prev,
                ai_session_active: false,
                ai_turns: 0,
                user_turns: 0,
                silence_timer_active: false,
                session_timer_active: false,
            }));

            // Clear timers
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
            }
            if (sessionTimerRef.current) {
                clearTimeout(sessionTimerRef.current);
            }
        },
        [updateKBVariables]
    );

    // Track AI turns (called when AI responds)
    const incrementAITurns = useCallback(() => {
        setState((prev) => {
            // Only increment if session is active
            if (!prev.ai_session_active) {
                console.log(
                    "⚠️ Skipping AI turn increment - no active session"
                );
                return prev;
            }

            const newAITurns = prev.ai_turns + 1;

            // Check turn cap
            if (newAITurns >= timerConfig.max_ai_turns) {
                console.log("🚨 AI turn cap reached - injecting [[SYS:WRAP]]");
                injectSilentMessage("[[SYS:WRAP]]");
            }

            return { ...prev, ai_turns: newAITurns };
        });
    }, [timerConfig.max_ai_turns, injectSilentMessage]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
            }
            if (sessionTimerRef.current) {
                clearTimeout(sessionTimerRef.current);
            }
        };
    }, []);

    // Update candidate name when it changes
    useEffect(() => {
        if (candidateName !== kbVariables.candidate_name) {
            updateKBVariables({ candidate_name: candidateName });
        }
    }, [candidateName, kbVariables.candidate_name, updateKBVariables]);

    return {
        // State
        state,
        kbVariables,

        // Actions
        updateKBVariables,
        handleUserTranscript,
        processAIMessage,
        setCodingState,
        handleSubmission,
        incrementAITurns,

        // Timer controls
        startSilenceTimer,
        startSessionTimer,
        injectSilentMessage,

        // Utilities
        isNonSemanticTranscript,
        isDirectMeaningfulQuestion,
    };
};
