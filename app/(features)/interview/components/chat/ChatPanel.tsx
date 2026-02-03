"use client";

import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEW_UI;

import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/shared/state/store";
import { MessageSquare, Mic, MicOff } from "lucide-react";
import TypingIndicator from "./TypingIndicator";

interface TranscriptionMessage {
    id: string;
    text: string;
    speaker: "user" | "ai";
    timestamp: Date;
    pasteEvaluationId?: string;
}

interface ChatPanelProps {
    micMuted?: boolean;
    onToggleMicMute?: () => void;
    onSendText?: (text: string) => Promise<void>;
    isInputDisabled?: boolean;
    isInterviewActive?: boolean;
    isAgentConnected?: boolean;
    micStream?: MediaStream | null;
}

const ChatPanel = ({ micMuted = false, onToggleMicMute, onSendText, isInputDisabled = false, isInterviewActive = false, isAgentConnected = false, micStream }: ChatPanelProps) => {
    const messages = useSelector((s: RootState) => s.coding.messages);
    const transcriptions: TranscriptionMessage[] = messages.map((m) => ({
        id: m.id,
        text: m.text,
        speaker: m.speaker,
        timestamp: new Date(m.timestamp),
        pasteEvaluationId: m.pasteEvaluationId,
    }));
    const isRecording = useSelector((s: RootState) => s.interview.isRecording);
    const isPendingReply = useSelector((s: RootState) => s.coding.pendingReply);
    const activePasteEval = useSelector((s: RootState) => s.coding.activePasteEvaluation);
    const [activePasteEvalId, setActivePasteEvalId] = useState<string | undefined>();
    const [showQuickReply, setShowQuickReply] = useState(false);
    const [buttonClicked, setButtonClicked] = useState(false);
    const [isVoiceRecording, setIsVoiceRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Track active paste evaluation changes
    useEffect(() => {
        const newActivePasteEvalId = activePasteEval?.pasteEvaluationId;
        
        // Reset buttonClicked if paste eval ID changed (new paste)
        if (newActivePasteEvalId !== activePasteEvalId) {
            setButtonClicked(false);
        }
        setActivePasteEvalId(newActivePasteEvalId);
        
        // Show quick reply if there's an active paste eval, user hasn't answered yet, and button wasn't clicked
        setShowQuickReply(
            !!activePasteEval && 
            activePasteEval.answerCount === 0 && 
            !!activePasteEval.currentQuestion &&
            !buttonClicked
        );
    }, [activePasteEval, activePasteEvalId, buttonClicked]);

    useEffect(() => {}, [transcriptions, isRecording]);

    // Auto-focus input when it gets re-enabled
    useEffect(() => {
        if (!isInputDisabled && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isInputDisabled]);

    // Auto-scroll to bottom when new messages arrive or typing indicator appears (smooth)
    useEffect(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTo({
                top: messagesContainerRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [messages.length, isPendingReply]);

    const startVoiceRecording = async () => {
        if (!micStream) return;

        try {
            const mimeType = "audio/webm;codecs=opus";
            const mediaRecorder = new MediaRecorder(micStream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                setIsTranscribing(true);
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

                const formData = new FormData();
                formData.append("audio", audioBlob, "recording.webm");

                try {
                    const response = await fetch("/api/transcribe", {
                        method: "POST",
                        body: formData,
                    });

                    const { text } = await response.json();
                    if (inputRef.current) {
                        const currentText = inputRef.current.value;
                        inputRef.current.value = currentText ? `${currentText} ${text}` : text;
                        inputRef.current.focus();
                    }
                } catch (error) {
                    log.error(LOG_CATEGORY, "Transcription error:", error);
                } finally {
                    setIsTranscribing(false);
                }
            };

            mediaRecorder.start();
            setIsVoiceRecording(true);
        } catch (error) {
            log.error(LOG_CATEGORY, "Failed to start recording:", error);
        }
    };

    const stopVoiceRecording = () => {
        if (mediaRecorderRef.current && isVoiceRecording) {
            mediaRecorderRef.current.stop();
            setIsVoiceRecording(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                            Chat
                        </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="text-xs font-medium">
                            <span
                                className={
                                    isInterviewActive && isAgentConnected
                                        ? "text-green-600 dark:text-green-400"
                                        : "text-gray-500 dark:text-gray-400"
                                }
                            >
                                {isInterviewActive && isAgentConnected
                                    ? "connected"
                                    : "disconnected"}
                            </span>
                        </div>
                        {typeof onSendText !== "function" && (
                            <button
                                onClick={onToggleMicMute}
                                className={`relative p-1 rounded-full transition-all duration-200 ${
                                    micMuted
                                        ? "bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30"
                                        : "hover:bg-gray-200 dark:hover:bg-gray-700"
                                }`}
                                title={
                                    micMuted
                                        ? "Unmute microphone"
                                        : "Mute microphone"
                                }
                            >
                                {micMuted ? (
                                    <>
                                        <MicOff className="w-4 h-4 text-red-600 dark:text-red-400" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-5 h-0.5 bg-red-600 dark:bg-red-400 rotate-45 transform origin-center"></div>
                                        </div>
                                    </>
                                ) : isRecording ? (
                                    <Mic className="w-4 h-4 text-red-500 animate-pulse" />
                                ) : (
                                    <Mic className="w-4 h-4 text-gray-400" />
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Messages Area - Simple scrollable container */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-3">
                    {transcriptions.length === 0 ? (
                        <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">
                                Your chat will appear here
                            </p>
                            <p className="text-xs mt-1">
                                Start interview to begin
                            </p>
                        </div>
                    ) : (
                        <>
                            {transcriptions.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex ${
                                        message.speaker === "user"
                                            ? "justify-end"
                                            : "justify-start"
                                    }`}
                                >
                                    <div
                                        className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg text-sm ${
                                            message.pasteEvaluationId
                                                ? message.speaker === "user"
                                                    ? "bg-green-100 text-gray-900 dark:bg-green-900 dark:text-white"
                                                    : "bg-green-50 text-gray-900 dark:bg-green-950 dark:text-white"
                                                : message.speaker === "user"
                                                ? "bg-blue-600 text-white"
                                                : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                                        }`}
                                    >
                                        <div className="flex items-center space-x-2 mb-1">
                                            <span className="text-xs opacity-75">
                                                {message.speaker === "ai"
                                                    ? "Sfinx"
                                                    : "You"}
                                            </span>
                                        </div>
                                        <p>{message.text}</p>
                                        <span className="text-xs opacity-50 mt-1 block">
                                            {message.timestamp.toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {showQuickReply && activePasteEvalId && (
                                <div className="flex justify-center my-2">
                                    <button
                                        onClick={async () => {
                                            setButtonClicked(true);
                                            if (onSendText) {
                                                await onSendText("I don't know");
                                            }
                                        }}
                                        className="px-4 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-gray-900 dark:text-white rounded-lg text-sm font-medium transition-colors border border-green-300 dark:border-green-700"
                                    >
                                        I don't know
                                    </button>
                                </div>
                            )}
                            {isPendingReply && <TypingIndicator />}
                        </>
                    )}
                </div>
            </div>

            {/* Footer / Text input when text-mode */}
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                {typeof onSendText === "function" ? (
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget as HTMLFormElement);
                            const text = String(fd.get("chat_input") || "").trim();
                            // eslint-disable-next-line no-console
                            log.info(LOG_CATEGORY, "[chat][submit]", text);
                            if (!text) return;
                            (e.currentTarget as HTMLFormElement).reset();
                            await onSendText(text);
                        }}
                        className="flex items-center gap-2"
                    >
                        <textarea
                            ref={inputRef}
                            name="chat_input"
                            placeholder="Type your message…"
                            className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm resize-none"
                            disabled={isInputDisabled}
                            rows={3}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    e.currentTarget.form?.requestSubmit();
                                }
                            }}
                        />
                        <div className="flex gap-1">
                            <button
                                type="button"
                                onClick={isVoiceRecording ? stopVoiceRecording : startVoiceRecording}
                                disabled={isInputDisabled || !micStream}
                                className={`p-2 rounded-md transition-all duration-200 ${
                                    isVoiceRecording
                                        ? "bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30"
                                        : isTranscribing
                                        ? "bg-blue-100 dark:bg-blue-900/20"
                                        : "hover:bg-gray-200 dark:hover:bg-gray-700"
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                title={isVoiceRecording ? "Stop recording" : isTranscribing ? "Transcribing..." : "Start recording"}
                            >
                                {isTranscribing ? (
                                    <div className="w-5 h-5 flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                                    </div>
                                ) : isVoiceRecording ? (
                                    <Mic className="w-5 h-5 text-red-500 animate-pulse" />
                                ) : (
                                    <Mic className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                )}
                            </button>
                            <button
                                type="submit"
                                className="px-3 py-2 text-sm rounded-md bg-sfinx-purple text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isInputDisabled}
                            >
                                Send
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                        <span>Live Voice Transcription</span>
                        <span>{transcriptions.length} messages</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatPanel;
