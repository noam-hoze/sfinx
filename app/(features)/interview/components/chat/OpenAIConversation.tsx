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
import OpenAI from "openai";
import { log } from "../../../../shared/services";
import { buildControlContextMessages, buildDeltaControlMessages, parseControlResult, CONTROL_CONTEXT_TURNS } from "../../../../shared/services";
import { useOpenAIRealtimeSession } from "@/shared/hooks/useOpenAIRealtimeSession";
import { store } from "@/shared/state/store";
import { buildOpenAIBackgroundPrompt, buildOpenAICodingPrompt } from "@/shared/prompts/openAIInterviewerPrompt";
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
    forceCoding,
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
        const [jsonTestResult, setJsonTestResult] = useState<string>("");
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
        const controlInFlightRef = useRef<boolean>(false);

        

        // --- Simple JSON test (Chat Completions) --------------------------------
        const openaiClient = useMemo(
            () =>
                new OpenAI({
                    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || "",
                    dangerouslyAllowBrowser: true,
                }),
            []
        );

        // Context builder is provided by shared/services/buildControlContext

        const requestControlViaChat = useCallback(async () => {
            if (controlInFlightRef.current) return;
            controlInFlightRef.current = true;
            try {
                setJsonTestResult("Loading CONTROL...");
                // Pull interview context (company/role/stage) for a more grounded evaluation
                const im = store.getState().interviewMachine;
                const company = String(im.companyName || im.companySlug || "Unknown Company");
                const role = String(im.roleSlug || "role").replace(/[-_]/g, " ");
                const s = interviewChatStore.getState();
                const { system: roHistory, assistant: lastQ, user: lastA } = buildDeltaControlMessages(CONTROL_CONTEXT_TURNS);
                const system = `You are the evaluation module for a technical interview at ${company} for the ${role} position.\nStage: Background.\n\nCRITICAL RULES:\n- Score ONLY the last user answer that follows.\n- Use the read-only history for understanding terms only; DO NOT award credit for past turns.\n- If the last user answer contains no concrete, attributable evidence for a pillar, output 0 for that pillar.\n- Every non-zero pillar MUST be justified with a short rationale referencing exact phrases from the last answer.\n- DO NOT initiate or suggest moving to coding; that decision is external and controlled by the system.\n\n${roHistory}\n\nOutput: STRICT JSON only (no preface) with fields: pillars {adaptability, creativity, reasoning} (0-100), rationale (string explaining your decision), pillarRationales {adaptability: string, creativity: string, reasoning: string}.`;
                try {
                    logger.info("[control][chat] request context", {
                        system,
                        turns: history.length,
                        history,
                    });
                } catch {}
                const completion = await openaiClient.chat.completions.create({
                    model: "gpt-4o-mini",
                    temperature: 0,
                    messages: [
                        { role: "system", content: system },
                        lastQ ? { role: "assistant", content: lastQ } : undefined,
                        lastA ? { role: "user", content: lastA } : undefined,
                    ].filter(Boolean) as any,
                    response_format: {
                        type: "json_schema",
                        json_schema: {
                            name: "control_schema",
                            schema: {
                                type: "object",
                                additionalProperties: false,
                                properties: {
                                    pillars: {
                                        type: "object",
                                        additionalProperties: false,
                                        properties: {
                                            adaptability: { type: "number" },
                                            creativity: { type: "number" },
                                            reasoning: { type: "number" },
                                        },
                                        required: ["adaptability", "creativity", "reasoning"],
                                    },
                                    rationale: { type: "string" },
                                    pillarRationales: {
                                        type: "object",
                                        additionalProperties: false,
                                        properties: {
                                            adaptability: { type: "string" },
                                            creativity: { type: "string" },
                                            reasoning: { type: "string" },
                                        },
                                        required: ["adaptability", "creativity", "reasoning"],
                                    },
                                },
                                required: [
                                    "pillars",
                                    "rationale",
                                    "pillarRationales",
                                ],
                            },
                            strict: true,
                        },
                    } as any,
                });
                try {
                    logger.info("[control][chat] raw completion", {
                        model: (completion as any)?.model,
                        usage: (completion as any)?.usage,
                        choices: (completion as any)?.choices,
                    });
                } catch {}
                const txt = completion.choices?.[0]?.message?.content ?? "";
                setJsonTestResult(txt);
                // Update store from parsed result if valid
                try {
                    const parsed = parseControlResult(txt);
                    const currentConfidence =
                        (parsed.pillars.adaptability + parsed.pillars.creativity + parsed.pillars.reasoning) / 3;
                    interviewChatStore.dispatch({
                        type: "BG_SET_CONTROL_RESULT",
                        payload: {
                            confidence: currentConfidence,
                            pillars: parsed.pillars,
                            rationales: {
                                overall: parsed.rationale,
                                adaptability: parsed.pillarRationales?.adaptability,
                                creativity: parsed.pillarRationales?.creativity,
                                reasoning: parsed.pillarRationales?.reasoning,
                            },
                        },
                    } as any);
                    interviewChatStore.dispatch({
                        type: "BG_ACCUMULATE_CONTROL_RESULT",
                        payload: { pillars: parsed.pillars },
                    } as any);

                    // Guard: only after we've seen a meaningful (non-zero) answer in this project
                    try {
                        const bg = interviewChatStore.getState().background as any;
                        const zeroRuns = Number(bg?.zeroRuns || 0);
                        const seenNonZero = Boolean(bg?.seenNonZero);
                        // Simplified rule: two consecutive zeros within the current project → cap reached
                        if (seenNonZero && zeroRuns >= 2) {
                            interviewChatStore.dispatch({
                                type: "BG_GUARD_SET_REASON",
                                payload: { reason: "projects_cap" },
                            } as any);
                            // Cancel any ongoing reply and immediately switch to coding
                            try {
                                sessionRef.current?.transport?.sendEvent?.({ type: "response.cancel" });
                            } catch {}
                            try {
                                store.dispatch(forceCoding());
                                interviewChatStore.dispatch({ type: "SET_STAGE", payload: "coding" } as any);
                            } catch {}
                            // No additional instructions or chat echo; coding persona handles the task
                        }
                    } catch {}
                } catch {}
            } catch (e: any) {
                setJsonTestResult(`CONTROL ERROR: ${String(e?.message || e)}`);
            } finally {
                controlInFlightRef.current = false;
            }
        }, []);

        

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
                try {
                    // Keep lightweight store in sync for CONTROL context building
                    interviewChatStore.dispatch({
                        type: "ADD_MESSAGE",
                        payload: { text, speaker },
                    } as any);
                } catch {}
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
        const codingPromptInjectedRef = useRef<boolean>(false);
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
                                try {
                                    logger.info("[openai][prompt][background_question]\n" + text);
                                } catch {}
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
                                try {
                                    respond();
                                } catch {}
                                // Also trigger CONTROL evaluation via Chat Completions (out-of-band)
                                try {
                                    const st = interviewChatStore.getState();
                                    if (st.stage === "background") {
                                        setJsonTestResult("Loading CONTROL...");
                                        void requestControlViaChat();
                                    }
                                } catch {}
                            }
                            // Do not present coding yet; will be triggered by CONTROL gate
                        } catch {}
                    } else if (m.role === "ai") {
                        try {
                            const textRaw = String(m.text || "").trim();
                                dispatch(machineAiFinal({ text: textRaw }));
                                emitMachineState();
                                if (textRaw) postToChat(textRaw, m.role);
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
                try {
                    (window as any).__sfinxOpenAITransport = sessionRef.current?.transport;
                } catch {}
                // Inject Background-only persona as a system prompt (no respond here)
                try {
                    const ms = store.getState().interviewMachine;
                    const companyName = ms.companyName || "Company";
                    const persona = buildOpenAIBackgroundPrompt(companyName);
                    try {
                        logger.info("[openai][prompt][persona]\n" + persona);
                    } catch {}
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
                    try {
                        logger.info("[openai][prompt][greeting]\n" + text);
                    } catch {}
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

        // Inject coding-stage persona when state transitions to in_coding_session
        useEffect(() => {
            const unsubscribe = store.subscribe(() => {
                try {
                    const ms = store.getState().interviewMachine;
                    if (ms.state === "in_coding_session" && !codingPromptInjectedRef.current) {
                        const companyName = ms.companyName || "Company";
                        const taskText = (scriptRef.current as any)?.codingPrompt;
                        if (typeof taskText !== "string" || taskText.trim() === "") {
                            logger.error("[openai][coding][missing_prompt] codingPrompt not found in script");
                            return;
                        }
                        const persona = buildOpenAICodingPrompt(companyName, taskText);
                        try {
                            logger.info("[openai][prompt][coding_persona]\n" + persona);
                        } catch {}
                        try {
                            sessionRef.current?.transport?.sendEvent?.({
                                type: "conversation.item.create",
                                item: {
                                    type: "message",
                                    role: "system",
                                    content: [{ type: "input_text", text: persona }],
                                },
                            });
                        } catch {}
                        try {
                            respond();
                        } catch {}
                        codingPromptInjectedRef.current = true;
                    }
                } catch {}
            });
            return () => {
                try {
                    unsubscribe();
                } catch {}
            };
        }, []);

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
                    try {
                        logger.info("[openai][prompt][followup_delta]\n" + text);
                    } catch {}
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
                    try {
                        logger.info("[openai][prompt][closing]\n" + text);
                    } catch {}
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
                try {
                    (window as any).__sfinxOpenAITransport = null;
                } catch {}
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
                {/* <div className="mt-4 p-3 border rounded">
                    <button
                        className="ml-2 px-3 py-1.5 rounded bg-emerald-600 text-white"
                        onClick={requestControlViaChat}
                    >
                        Request CONTROL (Chat)
                    </button>
                    {jsonTestResult.startsWith("Loading") && (
                        <div className="text-xs text-gray-500 mt-2">{jsonTestResult}</div>
                    )}
                </div> */}
                
            </div>
        );
    }
);

OpenAIConversation.displayName = "OpenAIConversation";

export default OpenAIConversation;
