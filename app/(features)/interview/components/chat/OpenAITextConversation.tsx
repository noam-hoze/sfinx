"use client";

import React, {
    useEffect,
    useRef,
    useCallback,
    forwardRef,
    useImperativeHandle,
} from "react";
import { useInterview } from "../../../../shared/contexts";
import type { RoleConfig } from "../../../../shared/contexts/types";
import { logger } from "../../../../shared/services";
import { buildClientTools, registerClientTools } from "./clientTools";
import { appendTranscriptLine } from "../../../../shared/services/recordings";

const log = logger.for("@OpenAITextConversation.tsx");
// Simple question matcher: token overlap on lowercased words (no stopwords)
function normalize(text: string): string[] {
    return (text || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(
            (w) =>
                w &&
                !new Set([
                    "the",
                    "a",
                    "an",
                    "and",
                    "or",
                    "to",
                    "of",
                    "in",
                    "on",
                    "for",
                    "with",
                    "how",
                    "what",
                    "do",
                    "you",
                ]).has(w)
        );
}
function overlapScore(a: string, b: string): number {
    const A = new Set(normalize(a));
    const B = new Set(normalize(b));
    if (A.size === 0 || B.size === 0) return 0;
    let inter = 0;
    for (const w of A) if (B.has(w)) inter++;
    const denom = Math.min(A.size, B.size);
    return inter / denom;
}

if (typeof window !== "undefined") {
    logger.setEnabled(true);
    logger.setNamespacedOnly(true);
    logger.setModules([
        "@RealTimeConversation.tsx",
        "@InterviewIDE.tsx",
        "@clientTools.ts",
        "@OpenAITextConversation.tsx",
        "@useOpenAiAsCandidate.ts",
        "@RightPanel.tsx",
    ]);
    logger.setLevels(["debug", "info", "warn", "error"]);
}

type Props = {
    onStartConversation?: () => void;
    onEndConversation?: () => void;
    onInterviewConcluded?: () => void;
    isInterviewActive?: boolean;
    candidateName?: string;
    roles?: RoleConfig;
    handleUserTranscript?: (transcript: string) => Promise<void>;
    updateKBVariables?: (updates: any) => Promise<void>;
    kbVariables?: any;
};

const OpenAITextConversation = forwardRef<any, Props>(
    (
        {
            onStartConversation,
            onEndConversation,
            isInterviewActive = false,
            candidateName = "Candidate",
            handleUserTranscript,
            kbVariables,
        },
        ref
    ) => {
        const { state, clearUserMessages, updateCurrentCode } = useInterview();
        const connectedRef = useRef<boolean>(false);
        const controllerRef = useRef<AbortController | null>(null);
        const messagesRef = useRef<any[]>([]);

        const postChatMessage = useCallback(
            (speaker: "ai" | "user", text: string) => {
                window.parent.postMessage(
                    {
                        type: "transcription",
                        text,
                        speaker,
                        timestamp: new Date(),
                        origin: "openai-adapter",
                    },
                    "*"
                );
            },
            []
        );

        const startConversation = useCallback(async () => {
            connectedRef.current = true;
            controllerRef.current = new AbortController();
            onStartConversation?.();
            // Load interview profile dynamically (no fallback)
            try {
                const params = new URLSearchParams(window.location.search);
                const company = params.get("company");
                const role = params.get("role");
                const candidateId =
                    params.get("candidateId") || params.get("candidate");
                if (!company || !role) throw new Error("Missing company/role");
                const res = await fetch(
                    `/api/interviews/config?company=${encodeURIComponent(
                        company
                    )}&role=${encodeURIComponent(role)}${
                        candidateId
                            ? `&candidateId=${encodeURIComponent(candidateId)}`
                            : ""
                    }`
                );
                if (!res.ok)
                    throw new Error(`Config load failed: ${res.status}`);
                const data = await res.json();
                (window as any).__interviewProfile = data.profile;
                // Log full candidate config for verification
                try {
                    log.info("🔍 Candidate profile", {
                        company,
                        role,
                        candidateId: data?.candidateId || candidateId,
                        candidate: data?.profile?.candidate,
                    });
                } catch (_) {}
            } catch (e) {
                log.error("Interview profile load error", e);
                throw e;
            }
            const tools = buildClientTools(
                () => state.currentCode || "",
                (code: string) => updateCurrentCode(code)
            );
            await registerClientTools(
                {
                    setClientTools: (_: any) => {},
                    registerClientTool: () => {},
                    addClientTool: () => {},
                } as any,
                tools
            );
            log.info("OpenAI adapter ready (text-only)");
            // Seed system message with persona and QA guidance
            const profile = (window as any).__interviewProfile || {};
            const displayName =
                profile.displayName || candidateName || "Candidate";
            const qaBlock = (() => {
                try {
                    const qa: Array<{ question: string; answer: string }> =
                        profile?.candidate?.answers || [];
                    if (!qa.length) return "";
                    const lines = qa
                        .map(
                            (p: any, i: number) =>
                                `Q${i + 1}: ${p.question}\nA${i + 1}: ${
                                    p.answer
                                }`
                        )
                        .join("\n\n");
                    return `INTERVIEW_QA (use these when the question matches):\n${lines}`;
                } catch (_) {
                    return "";
                }
            })();
            const systemContent = [
                profile.prompt || "",
                `Name: ${displayName}`,
                qaBlock,
            ]
                .filter(Boolean)
                .join("\n\n");
            messagesRef.current = [{ role: "system", content: systemContent }];
        }, [
            onStartConversation,
            state.currentCode,
            updateCurrentCode,
            candidateName,
        ]);

        const stopConversation = useCallback(() => {
            controllerRef.current?.abort();
            connectedRef.current = false;
            onEndConversation?.();
        }, [onEndConversation]);

        const sendUserMessage = useCallback(
            async (message: string) => {
                if (!connectedRef.current) return false;

                try {
                    // Refresh system persona (name only) each turn
                    const profile = (window as any).__interviewProfile || {};
                    const displayName =
                        profile.displayName || candidateName || "Candidate";
                    const editorBlob = (state.currentCode || "").slice(0, 8000);
                    const qaBlock = (() => {
                        try {
                            const qa: Array<{
                                question: string;
                                answer: string;
                            }> = profile?.candidate?.answers || [];
                            if (!qa.length) return "";
                            const lines = qa
                                .map(
                                    (p: any, i: number) =>
                                        `Q${i + 1}: ${p.question}\nA${i + 1}: ${
                                            p.answer
                                        }`
                                )
                                .join("\n\n");
                            return `INTERVIEW_QA (use these when the question matches):\n${lines}`;
                        } catch (_) {
                            return "";
                        }
                    })();
                    const systemContent = [
                        profile.prompt || "",
                        `Name: ${displayName}`,
                        qaBlock,
                        `EDITOR_CONTENT:\n${editorBlob}`,
                    ]
                        .filter(Boolean)
                        .join("\n\n");
                    if (
                        messagesRef.current.length === 0 ||
                        messagesRef.current[0]?.role !== "system"
                    ) {
                        messagesRef.current.unshift({
                            role: "system",
                            content: systemContent,
                        });
                    } else {
                        messagesRef.current[0] = {
                            role: "system",
                            content: systemContent,
                        };
                    }

                    // Append user turn (transcript for interviewer is logged by RealTimeConversation via Web Speech)
                    messagesRef.current.push({
                        role: "user",
                        content: message,
                    });

                    const payload = {
                        messages: messagesRef.current,
                        enableTools: true,
                    } as any;

                    const res = await fetch("/api/openai/chat", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                        signal: controllerRef.current?.signal,
                    });
                    const data = await res.json();
                    const toolCalls = data?.tool_calls || [];
                    let assistantText: string | null = data?.text || null;

                    const toolResults: Array<{
                        tool_call_id: string;
                        output: any;
                    }> = [];
                    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
                        log.info("OpenAI tool_calls", toolCalls);
                        for (const call of toolCalls) {
                            try {
                                const tools = buildClientTools(
                                    () => state.currentCode || "",
                                    (code: string) => updateCurrentCode(code)
                                );
                                const handler = (tools as any)[
                                    call.function.name
                                ];
                                const parsedArgs =
                                    typeof call.function?.arguments === "string"
                                        ? JSON.parse(
                                              call.function.arguments || "{}"
                                          )
                                        : call.function?.arguments || {};
                                log.info(
                                    "Executing tool locally",
                                    call.function?.name,
                                    parsedArgs
                                );
                                const output = await handler?.(parsedArgs);
                                toolResults.push({
                                    tool_call_id: call.id,
                                    output,
                                });
                            } catch (e) {
                                toolResults.push({
                                    tool_call_id: call.id,
                                    output: { ok: false, error: String(e) },
                                });
                            }
                        }

                        // Build continuation: system + user + assistant(tool_calls) + tool results
                        const profile =
                            (window as any).__interviewProfile || {};
                        const displayName =
                            profile.displayName || candidateName || "Candidate";
                        const kbBlob = JSON.stringify({
                            candidate_name: displayName,
                            is_coding: !!kbVariables?.is_coding,
                            current_code_summary:
                                kbVariables?.current_code_summary || "",
                        });
                        const editorBlob2 = (state.currentCode || "").slice(
                            0,
                            8000
                        );
                        const systemContent = [
                            profile.prompt || "",
                            `Name: ${displayName}`,
                            `KB: ${kbBlob}`,
                            `EDITOR_CONTENT:\n${editorBlob2}`,
                        ].join("\n\n");

                        const assistantToolMsg = {
                            role: "assistant",
                            content: null,
                            tool_calls: toolCalls.map((tc: any) => ({
                                id: tc.id,
                                type: "function",
                                function: {
                                    name: tc.function?.name,
                                    arguments: JSON.stringify(
                                        tc.function?.arguments || {}
                                    ),
                                },
                            })),
                        } as any;
                        // Persist assistant tool_calls and tool results
                        messagesRef.current.push(assistantToolMsg);
                        const toolMsgs = toolResults.map((r) => ({
                            role: "tool",
                            tool_call_id: r.tool_call_id,
                            content: JSON.stringify(r.output),
                        }));
                        messagesRef.current.push(...toolMsgs);

                        const res2 = await fetch("/api/openai/chat", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                messages: messagesRef.current,
                            }),
                            signal: controllerRef.current?.signal,
                        });
                        const data2 = await res2.json();
                        if (!res2.ok) {
                            log.error("OpenAI follow-up error", data2);
                        }
                        assistantText = data2?.text || assistantText;
                    }

                    if (assistantText) {
                        postChatMessage("ai", assistantText);
                        try {
                            const sessionId = (window as any)
                                ?.__recordingSessionId;
                            if (sessionId) {
                                void appendTranscriptLine(
                                    sessionId,
                                    "candidate",
                                    "larry_sim",
                                    assistantText
                                );
                            }
                        } catch (_) {}
                        messagesRef.current.push({
                            role: "assistant",
                            content: assistantText,
                        });
                    }
                    return true;
                } catch (error) {
                    log.error("OpenAI adapter sendUserMessage failed", error);
                    return false;
                }
            },
            [
                candidateName,
                kbVariables,
                postChatMessage,
                state.currentCode,
                updateCurrentCode,
            ]
        );

        useImperativeHandle(ref, () => ({
            startConversation,
            stopConversation,
            sendUserMessage,
        }));

        // Drive lifecycle from communication state (not recording)
        useEffect(() => {
            (async () => {
                try {
                    if (isInterviewActive) {
                        if (!connectedRef.current) {
                            await startConversation();
                        }
                    } else {
                        if (connectedRef.current) {
                            stopConversation();
                        }
                    }
                } catch (e) {
                    log.error("OpenAI adapter start/stop error", e);
                }
            })();
        }, [isInterviewActive, startConversation, stopConversation]);

        useEffect(() => {
            if (!connectedRef.current) return;
            const msgs = state.userMessagesQueue || [];
            if (msgs.length > 0) {
                (async () => {
                    for (const m of msgs) {
                        await sendUserMessage(m);
                    }
                    clearUserMessages();
                })();
            }
        }, [state.userMessagesQueue, sendUserMessage, clearUserMessages]);

        // Follow RealTimeConversation status and transcripts
        useEffect(() => {
            const onMessage = (event: MessageEvent) => {
                // Mirror recording status: flip connection and invoke callbacks
                if (event.data?.type === "recording-status") {
                    const isRec = Boolean(event.data.isRecording);
                    connectedRef.current = isRec;
                    if (isRec) onStartConversation?.();
                    else onEndConversation?.();
                }
                // On coding start: prime system with current editor content (workaround because explicit local open_file didn't reliably ground the first turn)
                if (event.data?.type === "coding-started") {
                    (async () => {
                        try {
                            // Prime system with current editor content so the model "has eyes"
                            const profile =
                                (window as any).__interviewProfile || {};
                            const displayName =
                                profile.displayName ||
                                candidateName ||
                                "Candidate";
                            const editorBlob = (state.currentCode || "").slice(
                                0,
                                8000
                            );
                            const systemContent = [
                                profile.prompt || "",
                                `Name: ${displayName}`,
                                `EDITOR_CONTENT:\n${editorBlob}`,
                            ].join("\n\n");
                            if (
                                messagesRef.current.length === 0 ||
                                messagesRef.current[0]?.role !== "system"
                            ) {
                                messagesRef.current.unshift({
                                    role: "system",
                                    content: systemContent,
                                });
                            } else {
                                messagesRef.current[0] = {
                                    role: "system",
                                    content: systemContent,
                                } as any;
                            }
                        } catch (_) {}
                    })();
                    return;
                }
                // Consume interviewer (user) transcripts and forward to OpenAI
                if (event.data?.type === "transcription") {
                    if (event.data.origin === "openai-adapter") return; // ignore our own posts
                    if (event.data.origin === "mic-webspeech") {
                        // Already posted to ChatPanel by RTC; avoid double-post and just forward to OpenAI
                        const text = event.data.text as string;
                        if (text) void sendUserMessage(text);
                        return;
                    }
                    const speaker = event.data.speaker;
                    const text = event.data.text as string;
                    if (speaker === "user" && text) {
                        void sendUserMessage(text);
                    }
                }
            };
            window.addEventListener("message", onMessage);
            return () => window.removeEventListener("message", onMessage);
        }, [onStartConversation, onEndConversation, sendUserMessage]);

        return (
            <div className="w-full max-w-4xl mx-auto text-center text-gray-400">
                <p>
                    {connectedRef.current
                        ? isInterviewActive
                            ? "Listening..."
                            : "Idle"
                        : "Disconnected"}
                </p>
            </div>
        );
    }
);

OpenAITextConversation.displayName = "OpenAITextConversation";

export default OpenAITextConversation;
