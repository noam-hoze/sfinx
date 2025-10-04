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
import candidateProfile from "server/data/candidates/larry_frontend_developer.json";

const log = logger.for("@OpenAITextConversation.tsx");
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
            // Seed system message with persona (name only)
            const displayName =
                (candidateProfile as any)?.displayName ||
                candidateName ||
                "Larry";
            const systemContent = [
                (candidateProfile as any)?.prompt || "",
                `Name: ${displayName}`,
            ].join("\n\n");
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
                    const displayName =
                        (candidateProfile as any)?.displayName ||
                        candidateName ||
                        "Larry";
                    const systemContent = [
                        (candidateProfile as any)?.prompt || "",
                        `Name: ${displayName}`,
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
                        };
                    }

                    // Append user turn
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
                                // Prefer animated typing when doing full replace
                                if (
                                    call.function?.name === "write_file" &&
                                    parsedArgs &&
                                    typeof parsedArgs === "object" &&
                                    typeof parsedArgs.content === "string"
                                ) {
                                    parsedArgs.animate = true;
                                }
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
                        const displayName =
                            (candidateProfile as any)?.displayName ||
                            candidateName ||
                            "Larray";
                        const kbBlob = JSON.stringify({
                            candidate_name: displayName,
                            is_coding: !!kbVariables?.is_coding,
                            current_code_summary:
                                kbVariables?.current_code_summary || "",
                        });
                        const systemContent = [
                            (candidateProfile as any)?.prompt || "",
                            `Name: ${displayName}`,
                            `KB: ${kbBlob}`,
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
