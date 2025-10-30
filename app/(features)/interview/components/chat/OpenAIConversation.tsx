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
import { buildControlContextMessages, parseControlResult, CONTROL_CONTEXT_TURNS } from "../../../../shared/services";
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

        

        // --- Simple JSON test (Chat Completions) --------------------------------
        const openaiClient = useMemo(
            () =>
                new OpenAI({
                    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || "",
                    dangerouslyAllowBrowser: true,
                }),
            []
        );

        const requestJsonTest = useCallback(async () => {
            try {
                setJsonTestResult("Loading...");
                const completion = await openaiClient.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "user",
                            content: `Return ONLY JSON: {"ok":true,"time":${Date.now()}}`,
                        },
                    ],
                    response_format: { type: "json_object" },
                });
                const txt = completion.choices?.[0]?.message?.content ?? "";
                setJsonTestResult(txt);
            } catch (e: any) {
                setJsonTestResult(`ERROR: ${String(e?.message || e)}`);
            }
        }, [openaiClient]);

        // Context builder is provided by shared/services/buildControlContext

        const requestControlViaChat = useCallback(async () => {
            try {
                setJsonTestResult("Loading CONTROL...");
                // Pull interview context (company/role/stage) for a more grounded evaluation
                const im = store.getState().interviewMachine;
                const company = String(im.companyName || im.companySlug || "Unknown Company");
                const role = String(im.roleSlug || "role").replace(/[-_]/g, " ");
                const s = interviewChatStore.getState();
                const history = buildControlContextMessages(CONTROL_CONTEXT_TURNS);
                const kTurns = history.length;
                const asked = s.background?.questionsAsked ?? 0;
                const system = `You are the evaluation module for a technical interview at ${company} for the ${role} position.\nStage: Background.\nHistory length: ${kTurns} turns (assistant/user), provided below.\nRules: Derive your assessment solely from this history—never infer or assume beyond it. If history contains no concrete evidence for a pillar, keep that pillar at the minimum of the scale. If history is empty, there is no evidence: all pillars remain at their minimum and readyToProceed is false.\nEvidence examples include: project details, constraints, challenges handled, trade-offs, and outcomes.\nOutput: STRICT JSON only (no preface) with fields: overallConfidence (0-100), pillars {adaptability, creativity, reasoning} (0-100), readyToProceed (boolean), rationale (string explaining your decision), pillarRationales {adaptability: string, creativity: string, reasoning: string}.`;
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
                    messages: [{ role: "system", content: system }, ...history],
                    response_format: {
                        type: "json_schema",
                        json_schema: {
                            name: "control_schema",
                            schema: {
                                type: "object",
                                additionalProperties: false,
                                properties: {
                                    overallConfidence: { type: "number" },
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
                                    readyToProceed: { type: "boolean" },
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
                                    "overallConfidence",
                                    "pillars",
                                    "readyToProceed",
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
                    interviewChatStore.dispatch({
                        type: "BG_SET_CONFIDENCE",
                        payload: Number(parsed.overallConfidence) || 0,
                    });
                } catch {}
            } catch (e: any) {
                setJsonTestResult(`CONTROL ERROR: ${String(e?.message || e)}`);
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
                                try {
                                    respond();
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
                <div className="mt-4 p-3 border rounded">
                    <button
                        className="px-3 py-1.5 rounded bg-blue-600 text-white"
                        onClick={requestJsonTest}
                    >
                        Request JSON (Chat)
                    </button>
                    <button
                        className="ml-2 px-3 py-1.5 rounded bg-emerald-600 text-white"
                        onClick={requestControlViaChat}
                    >
                        Request CONTROL (Chat)
                    </button>
                    <pre className="text-xs mt-2 whitespace-pre-wrap break-words">{jsonTestResult}</pre>
                </div>
            </div>
        );
    }
);

OpenAIConversation.displayName = "OpenAIConversation";

export default OpenAIConversation;
