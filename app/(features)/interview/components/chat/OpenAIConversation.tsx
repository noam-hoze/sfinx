/**
 * OpenAIConversation: UI-free adapter wiring WebRTC Realtime into the interview flow.
 * - Requests mic, opens session via useOpenAIRealtimeSession, posts final texts to parent.
 * - Delegates deterministic flow to openAIFlowController (greeting → background → ack).
 * - Exposes imperative API for parent: start/stop, mic toggle, contextual updates.
 */
"use client";

import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    useMemo,
    forwardRef,
    useImperativeHandle,
} from "react";
import { log } from "../../../../shared/services";
import { useOpenAIRealtimeSession } from "@/shared/hooks/useOpenAIRealtimeSession";
import { store } from "@/shared/state/store";
import { buildOpenAIInterviewerPrompt } from "@/shared/prompts/openAIInterviewerPrompt";
import { useDispatch } from "react-redux";
import {
    addMessage,
    setRecording,
} from "@/shared/state/slices/interviewChatSlice";
import {
    start as machineStart,
    aiFinal as machineAiFinal,
    userFinal as machineUserFinal,
    end as machineEnd,
    setExpectedBackgroundQuestion,
} from "@/shared/state/slices/interviewMachineSlice";
import { interviewChatStore } from "@/shared/state/interviewChatStore";
import { shouldAdvanceBackgroundStage } from "../../../../shared/services";
const logger = log;

interface OpenAIConversationProps {
    onStartConversation?: () => void;
    onEndConversation?: () => void;
    onInterviewConcluded?: () => void;
    isInterviewActive?: boolean;
    candidateName?: string;
    handleUserTranscript?: (transcript: string) => Promise<void>;
    kbVariables?: any;
    automaticMode?: boolean;
    onAutoStartCoding?: () => void;
}

/**
 * Minimal OpenAI Realtime adapter (WebRTC) matching RealTimeConversation API shape.
 * - Connects using ephemeral key from /api/openai/realtime
 * - Posts basic recording status to parent for ChatPanel indicator
 * - Stubs sendUserMessage/sendContextualUpdate (to be extended)
 */
const OpenAIConversation = forwardRef<any, OpenAIConversationProps>(
    (
        {
            onStartConversation,
            onEndConversation,
            onInterviewConcluded,
            isInterviewActive = false,
            candidateName = "Candidate",
            automaticMode = false,
            onAutoStartCoding,
        },
        ref
    ) => {
        const [isConnected, setIsConnected] = useState(false);
        const [isRecording, setIsRecording] = useState(false);
        const micStreamRef = useRef<MediaStream | null>(null);
        const sessionRef = useRef<any>(null);
        const micMutedRef = useRef<boolean>(false);
        type Stage = "awaiting_ready" | "background_asked" | "background_done";
        const stageRef = useRef<Stage>("awaiting_ready");
        const dispatch = useDispatch();
        const didConnectRef = useRef<boolean>(false);
        const didStartRef = useRef<boolean>(false);
        const didAskBackgroundRef = useRef<boolean>(false);
        const didAutoStartCodingRef = useRef<boolean>(false);
        const awaitingClosingRef = useRef<boolean>(false);
        const closingExpectedRef = useRef<string>("");
        const didPresentCodingRef = useRef<boolean>(false);
        // After the user’s first answer to the initial background question,
        // CONTROL becomes required on every subsequent AI background turn
        const controlRequiredRef = useRef<boolean>(false);
        const controlTimerRef = useRef<number | null>(null);

        const clearControlTimer = useCallback(() => {
            if (controlTimerRef.current) {
                clearTimeout(controlTimerRef.current as unknown as number);
                controlTimerRef.current = null;
            }
        }, []);

        function requestControlBackchannel() {
            if (!controlRequiredRef.current) return;
            try {
                const sys =
                    "CONTROL_REQUEST: Do not speak to the candidate. Return ONLY JSON {\"overallConfidence\":number,\"pillars\":{\"adaptability\":number,\"creativity\":number,\"reasoning\":number},\"readyToProceed\":boolean}.";
                session.current?.transport?.sendEvent?.({
                    type: "conversation.item.create",
                    item: {
                        type: "message",
                        role: "system",
                        content: [{ type: "input_text", text: sys }],
                    },
                });
                session.current?.transport?.sendEvent?.({
                    type: "response.create",
                    response: {
                        modalities: ["text"],
                        instructions:
                            "Return ONLY JSON: {\\\"overallConfidence\\\":number,\\\"pillars\\\":{\\\"adaptability\\\":number,\\\"creativity\\\":number,\\\"reasoning\\\":number},\\\"readyToProceed\\\":boolean}. No preface.",
                    },
                });
                clearControlTimer();
                controlTimerRef.current = window.setTimeout(() => {
                    logger.error("[control] timeout: no CONTROL received within 5s");
                    clearControlTimer();
                }, 5000) as unknown as number;
                logger.info("[openai] CONTROL backchannel requested");
            } catch (e) {
                logger.error("[openai] Failed to request CONTROL backchannel", {
                    error: (e as any)?.message || String(e),
                });
            }
        }

        const notifyRecording = useCallback(
            (val: boolean) => {
                dispatch(setRecording(val));
            },
            [dispatch]
        );

        const startConversation = useCallback(async () => {
            try {
                // Request mic perms upfront for UX parity with EL adapter
                const micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    } as MediaTrackConstraints,
                });
                micStreamRef.current = micStream;
                setIsRecording(true);
                notifyRecording(true);
            } catch (err) {
                logger.error("❌ OpenAIConversation: mic permission error", err);
            }
        }, [notifyRecording]);

        // --- helpers ------------------------------------------------------------
        const postToChat = useCallback(
            (text: string, speaker: "user" | "ai") => {
                if (!text) return;
                dispatch(addMessage({ text, speaker }));
            },
            [dispatch]
        );

        // Compose: realtime session + interview state store
        const emitMachineState = useCallback(() => {
            try {
                const ms = store.getState().interviewMachine;
                const state = ms.state;
                const context = { candidateName: ms.candidateName };
                logger.info("[interview-machine]", state, context);
                window.parent.postMessage(
                    { type: "interview-machine", state, context },
                    "*"
                );
            } catch {}
        }, []);
        const scriptRef = useRef<null>(null);
        const expectingUserRef = useRef<boolean>(false);
        const { connected, session, connect, respond, enableHandsFree, allowNextResponse } =
            useOpenAIRealtimeSession(
                (m) => {
                    if (m.role === "user") {
                        try {
                            dispatch(machineUserFinal());
                            emitMachineState();
                            postToChat(m.text, m.role);
                            // Stage: greeting → background on first user reply
                            try {
                                const s = interviewChatStore.getState();
                                if (s.stage === "greeting") {
                                    interviewChatStore.dispatch({
                                        type: "SET_STAGE",
                                        payload: "background",
                                    });
                                }
                            } catch {}
                            const ms = store.getState().interviewMachine;
                            const expectedQ = (scriptRef.current as any)
                                ?.backgroundQuestion;
                            if (
                                ms.state === "greeting_responded_by_user" &&
                                expectedQ &&
                                !didAskBackgroundRef.current
                            ) {
                                const text = `Ask exactly: "${String(
                                    expectedQ
                                )}"`;
                                session.current?.transport?.sendEvent?.({
                                    type: "conversation.item.create",
                                    item: {
                                        type: "message",
                                        role: "system",
                                        content: [{ type: "input_text", text }],
                                    },
                                });
                                // respond gated
                                try {
                                    respond();
                                } catch {}
                                didAskBackgroundRef.current = true;
                            }
                            // After any user background answer, allow the model to ask the next follow-up
                            if (ms.state === "background_answered_by_user") {
                                // From now on, require CONTROL on every AI turn in background
                                controlRequiredRef.current = true;
                                try {
                                    respond();
                                } catch {}
                                // Fire-and-forget CONTROL backchannel once per user background answer
                                requestControlBackchannel();
                            }
                            // Do not present coding yet; will be triggered by CONTROL gate
                        } catch {}
                    } else if (m.role === "ai") {
                        try {
                            const textRaw = String(m.text || "").trim();
                            // Try to interpret pure JSON as CONTROL backchannel (no visible posting)
                            let handledAsControl = false;
                            if (controlRequiredRef.current) {
                                try {
                                    // Fast-check brackets to avoid noisy parse attempts
                                    const looksJson =
                                        textRaw.startsWith("{") && textRaw.endsWith("}");
                                    const maybe = looksJson ? JSON.parse(textRaw) : null;
                                    if (
                                        maybe &&
                                        typeof maybe.overallConfidence === "number" &&
                                        typeof maybe.readyToProceed === "boolean" &&
                                        maybe.pillars
                                    ) {
                                        handledAsControl = true;
                                        logger.info("[openai] CONTROL parsed:", maybe);
                                        clearControlTimer();
                                        const s = interviewChatStore.getState();
                                        interviewChatStore.dispatch({
                                            type: "BG_SET_CONFIDENCE",
                                            payload: Number(maybe.overallConfidence) || 0,
                                        });
                                        interviewChatStore.dispatch({ type: "BG_INC_QUESTIONS" });
                                        const gate = shouldAdvanceBackgroundStage({
                                            currentConfidence: Number(maybe.overallConfidence) || 0,
                                            questionsAsked: s.background.questionsAsked + 1,
                                            transitioned: s.background.transitioned,
                                        });
                                        if (gate.shouldAdvance && maybe.readyToProceed === true) {
                                            interviewChatStore.dispatch({ type: "BG_MARK_TRANSITION" });
                                            interviewChatStore.dispatch({ type: "SET_STAGE", payload: "coding" });
                                            logger.info("[openai] Gate passed by CONTROL: advancing to coding");
                                            // Present coding challenge now (once), using codingChallenge.prompt
                                            try {
                                                if (!didPresentCodingRef.current) {
                                                    const prompt = (scriptRef.current as any)?.codingChallenge?.prompt;
                                                    if (typeof prompt === "string" && prompt.trim().length > 0) {
                                                        const sys = `Present the coding challenge exactly as follows, then wait for questions: "${String(
                                                            prompt
                                                        )}"`;
                                                        session.current?.transport?.sendEvent?.({
                                                            type: "conversation.item.create",
                                                            item: {
                                                                type: "message",
                                                                role: "system",
                                                                content: [{ type: "input_text", text: sys }],
                                                            },
                                                        });
                                                        try {
                                                            respond();
                                                        } catch {}
                                                        didPresentCodingRef.current = true;
                                                    }
                                                }
                                            } catch {}
                                        } else {
                                            // Not ready yet: ask one concise follow-up question
                                            try {
                                                const sysF =
                                                    "Ask ONE short follow-up question about the candidate's last background answer. Do not mention confidence or readiness.";
                                                session.current?.transport?.sendEvent?.({
                                                    type: "conversation.item.create",
                                                    item: {
                                                        type: "message",
                                                        role: "system",
                                                        content: [{ type: "input_text", text: sysF }],
                                                    },
                                                });
                                                respond();
                                            } catch {}
                                        }
                                    }
                                } catch (e) {
                                    logger.error("[openai] CONTROL raw (non-JSON)", {
                                        text: textRaw.slice(0, 200),
                                    });
                                }
                            }
                            // If not CONTROL-only, treat as visible spoken turn
                            if (!handledAsControl) {
                                // Detect CONTROL leakage into spoken output (policy violation)
                                if (
                                    controlRequiredRef.current &&
                                    /overallConfidence|\"pillars\"|readyToProceed/i.test(textRaw)
                                ) {
                                    logger.error("[policy] CONTROL leaked into spoken output", {
                                        text: textRaw.slice(0, 200),
                                    });
                                }
                                dispatch(machineAiFinal({ text: textRaw }));
                                emitMachineState();
                                if (textRaw) postToChat(textRaw, m.role);
                                // No control request here; it is sent after user's background answer
                            }
                        } catch {}
                    }
                },
                { agentName: "Carrie" }
            );

        // --- connect & wire -----------------------------------------------------
        const connectLegacy = useCallback(async () => {
            if (didConnectRef.current) return;
            didConnectRef.current = true;
            try {
                // Use new hook
                await connect();
                sessionRef.current = session.current;
                // Inject interviewer persona as a system prompt (no respond here)
                try {
                    const ms = store.getState().interviewMachine;
                    const companyName = ms.companyName || "Company";
                    const persona = buildOpenAIInterviewerPrompt(companyName);
                    sessionRef.current?.transport?.sendEvent?.({
                        type: "conversation.item.create",
                        item: {
                            type: "message",
                            role: "system",
                            content: [{ type: "input_text", text: persona }],
                        },
                    });
                } catch {}
                // Load interview script dynamically (company/role from store when available)
                try {
                    const ms = store.getState().interviewMachine;
                    const companySlug = ms.companySlug || "meta";
                    const roleSlug = ms.roleSlug || "frontend-engineer";
                    const resp = await fetch(
                        `/api/interviews/script?company=${companySlug}&role=${roleSlug}`
                    );
                    if (resp.ok) {
                        const data = await resp.json();
                        scriptRef.current = data;
                        if (data?.backgroundQuestion) {
                            dispatch(
                                setExpectedBackgroundQuestion({
                                    question: String(data.backgroundQuestion),
                                })
                            );
                        }
                    }
                } catch {}
                // If transport didn't auto-attach mic, attach our noise-suppressed track
                try {
                    const track = micStreamRef.current?.getAudioTracks?.()[0];
                    if (track && (session as any)?.addInputTrack) {
                        (session as any).addInputTrack(track);
                    }
                } catch {}

                // Start: enqueue deterministic greeting (once)
                if (!didStartRef.current) {
                    dispatch(machineStart({ candidateName }));
                    const name = candidateName || "Candidate";
                    const text = `Say exactly: "Hi ${name}, I'm Carrie. I'll be the one interviewing today!"`;
                    sessionRef.current?.transport?.sendEvent?.({
                        type: "conversation.item.create",
                        item: {
                            type: "message",
                            role: "system",
                            content: [{ type: "input_text", text }],
                        },
                    });
                    try {
                        respond();
                    } catch {}
                    didStartRef.current = true;
                }
                emitMachineState();
                setIsConnected(true);
                onStartConversation?.();
            } catch (e) {
                logger.error("❌ OpenAIConversation: connect failed", e);
            }
        }, [
            candidateName,
            connect,
            emitMachineState,
            onStartConversation,
            session,
            dispatch,
        ]);

        useEffect(() => {
            if (isRecording && !isConnected) {
                void connectLegacy();
            }
        }, [isRecording, isConnected]);

        const disconnect = useCallback(() => {
            try {
                if (micStreamRef.current) {
                    micStreamRef.current.getTracks().forEach((t) => t.stop());
                    micStreamRef.current = null;
                }
                setIsRecording(false);
                notifyRecording(false);
                if (sessionRef.current?.disconnect) {
                    sessionRef.current.disconnect();
                }
            } catch (_) {}
            setIsConnected(false);
            onEndConversation?.();
        }, [notifyRecording, onEndConversation]);

        const toggleMicMute = useCallback(() => {
            // Not yet wired to SDK input; reflect state to UI only
            micMutedRef.current = !micMutedRef.current;
            window.parent.postMessage(
                { type: "mic-state-changed", micMuted: micMutedRef.current },
                "*"
            );
        }, []);

        const sendUserMessage = useCallback(async (_message: string) => {
            logger.warn("OpenAIConversation.sendUserMessage not yet implemented");
            return false;
        }, []);

        useImperativeHandle(ref, () => ({
            startConversation,
            stopConversation: () => {
                disconnect();
            },
            sendContextualUpdate: async (_text: string) => {
                logger.warn(
                    "OpenAIConversation.sendContextualUpdate not yet implemented"
                );
            },
            sendUserMessage,
            micMuted: micMutedRef.current,
            toggleMicMute,
            askFollowupOnDelta: async (payload: {
                added: string;
                removed: string;
                addedChars: number;
                removedChars: number;
            }) => {
                try {
                    // Transition to followup state so UI and flow can react
                    try {
                        const { startFollowup } = await import(
                            "@/shared/state/slices/interviewMachineSlice"
                        );
                        dispatch(startFollowup());
                        emitMachineState();
                    } catch {}

                    const text = `Context: Code changes since last snapshot.\nAdded (${payload.addedChars} chars):\n"""\n${payload.added}\n"""\nRemoved (${payload.removedChars} chars):\n"""\n${payload.removed}\n"""\nInstruction: Ask exactly one short follow-up question about these changes, then wait silently for the user's answer.`;
                    session.current?.transport?.sendEvent?.({
                        type: "conversation.item.create",
                        item: {
                            type: "message",
                            role: "system",
                            content: [{ type: "input_text", text }],
                        },
                    });
                    try {
                        respond();
                    } catch {}
                } catch (e) {
                    logger.error("askFollowupOnDelta failed", e);
                }
            },
            sayClosingLine: async (name?: string) => {
                try {
                    const candidate = (name || candidateName || "Candidate").trim();
                    const expected = `Thank you so much ${candidate}, the next steps will be shared with you shortly.`;
                    closingExpectedRef.current = expected;
                    awaitingClosingRef.current = true;
                    // Interrupt any ongoing AI response and clear input buffer
                    try {
                        logger.info("[closing][submit] sending response.cancel");
                        session.current?.transport?.sendEvent?.({
                            type: "response.cancel",
                        });
                        logger.info("[closing][submit] response.cancel sent");
                    } catch {}
                    try {
                        logger.info("[closing][submit] clearing input_audio_buffer");
                        session.current?.transport?.sendEvent?.({
                            type: "input_audio_buffer.clear",
                        });
                        logger.info("[closing][submit] input_audio_buffer cleared");
                    } catch {}
                    const text = `Say exactly: "${expected}"`;
                    logger.info("[closing][submit] enqueue closing item.create", { text });
                    session.current?.transport?.sendEvent?.({
                        type: "conversation.item.create",
                        item: {
                            type: "message",
                            role: "system",
                            content: [{ type: "input_text", text }],
                        },
                    });
                    // Removed local Web Speech fallback to preserve voice consistency
                    try {
                        logger.info("[closing][submit] triggering respond()");
                        respond();
                        logger.info("[closing][submit] respond() called");
                    } catch {}
                } catch (e) {
                    logger.error("sayClosingLine failed", e);
                }
            },
        }));

        useEffect(() => {
            try {
                // @ts-ignore expose redux store for inspection
                (window as any).__sfinxStore = store;
            } catch {}
            return () => {
                if (micStreamRef.current) {
                    micStreamRef.current.getTracks().forEach((t) => t.stop());
                    micStreamRef.current = null;
                }
                if (sessionRef.current?.disconnect) {
                    sessionRef.current.disconnect();
                }
            };
        }, []);

        return (
            <div className="w-full max-w-4xl mx-auto">
                <div className="text-center text-gray-400">
                    <p>
                        {isConnected
                            ? isInterviewActive
                                ? "Listening..."
                                : "Connected"
                            : "Disconnected"}
                    </p>
                </div>
            </div>
        );
    }
);

OpenAIConversation.displayName = "OpenAIConversation";

export default OpenAIConversation;
