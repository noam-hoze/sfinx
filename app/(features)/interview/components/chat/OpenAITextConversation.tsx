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
        }, [onStartConversation, state.currentCode, updateCurrentCode]);

        const stopConversation = useCallback(() => {
            controllerRef.current?.abort();
            connectedRef.current = false;
            onEndConversation?.();
        }, [onEndConversation]);

        const sendUserMessage = useCallback(
            async (message: string) => {
                if (!connectedRef.current) return false;

                try {
                    const payload = {
                        messages: [
                            {
                                role: "system",
                                content:
                                    `You are the candidate named ${candidateName}. Keep responses short. ` +
                                    `Tool usage policy: Only call open_file/write_file when KB.is_coding === true. When KB.is_coding === false, do not call tools; ask to start coding instead. ` +
                                    `KB: ${JSON.stringify({
                                        candidate_name: candidateName,
                                        is_coding: !!kbVariables?.is_coding,
                                        current_code_summary:
                                            kbVariables?.current_code_summary ||
                                            "",
                                    })}`,
                            },
                            { role: "user", content: message },
                        ],
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
                        for (const call of toolCalls) {
                            try {
                                const tools = buildClientTools(
                                    () => state.currentCode || "",
                                    (code: string) => updateCurrentCode(code)
                                );
                                const handler = (tools as any)[
                                    call.function.name
                                ];
                                const output = await handler?.(
                                    call.function.arguments || {}
                                );
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

                        const res2 = await fetch("/api/openai/chat", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                messages: [
                                    {
                                        role: "system",
                                        content:
                                            "Tool results provided. Continue.",
                                    },
                                    {
                                        role: "tool",
                                        content: JSON.stringify(toolResults),
                                    },
                                ],
                            }),
                            signal: controllerRef.current?.signal,
                        });
                        const data2 = await res2.json();
                        assistantText = data2?.text || assistantText;
                    }

                    if (assistantText) {
                        postChatMessage("ai", assistantText);
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
