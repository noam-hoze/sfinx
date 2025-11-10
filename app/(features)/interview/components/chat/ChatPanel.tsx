"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/shared/state/store";
import { MessageSquare, Mic, MicOff } from "lucide-react";

interface TranscriptionMessage {
    id: string;
    text: string;
    speaker: "user" | "ai";
    timestamp: Date;
}

interface ChatPanelProps {
    micMuted?: boolean;
    onToggleMicMute?: () => void;
    onSendText?: (text: string) => Promise<void>;
    isInputDisabled?: boolean;
}

const ChatPanel = ({ micMuted = false, onToggleMicMute, onSendText, isInputDisabled = false }: ChatPanelProps) => {
    const chat = useSelector((s: RootState) => s.interviewChat);
    const transcriptions: TranscriptionMessage[] = chat.messages.map((m) => ({
        id: m.id,
        text: m.text,
        speaker: m.speaker,
        timestamp: new Date(m.timestamp),
    }));
    const isRecording = chat.isRecording;
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {}, [transcriptions, isRecording]);

    // Auto-focus input when it gets re-enabled
    useEffect(() => {
        if (!isInputDisabled && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isInputDisabled]);

    // Auto-scroll to bottom when new messages arrive (smooth)
    useEffect(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTo({
                top: messagesContainerRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [transcriptions]);

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
                        transcriptions.map((message) => (
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
                                        message.speaker === "user"
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                                    }`}
                                >
                                    <div className="flex items-center space-x-2 mb-1">
                                        <span className="text-xs opacity-75">
                                            {message.speaker === "ai"
                                                ? "AI"
                                                : "You"}
                                        </span>
                                    </div>
                                    <p>{message.text}</p>
                                    <span className="text-xs opacity-50 mt-1 block">
                                        {message.timestamp.toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        ))
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
                            console.log("[chat][submit]", text);
                            if (!text) return;
                            (e.currentTarget as HTMLFormElement).reset();
                            await onSendText(text);
                        }}
                        className="flex items-center gap-2"
                    >
                        <input
                            ref={inputRef}
                            name="chat_input"
                            placeholder="Type your message…"
                            className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                            disabled={isInputDisabled}
                        />
                        <button
                            type="submit"
                            className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isInputDisabled}
                        >
                            Send
                        </button>
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
