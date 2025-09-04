"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Mic, MicOff } from "lucide-react";

interface TranscriptionMessage {
    id: string;
    text: string;
    speaker: "user" | "ai";
    timestamp: Date;
}

const ChatPanel = () => {
    const [transcriptions, setTranscriptions] = useState<
        TranscriptionMessage[]
    >([]);
    const [isRecording, setIsRecording] = useState(false);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Listen for transcription events from RealTimeConversation
    useEffect(() => {
        const handleTranscription = (event: MessageEvent) => {
            if (event.data.type === "transcription") {
                const newTranscription: TranscriptionMessage = {
                    id: Date.now().toString(),
                    text: event.data.text,
                    speaker: event.data.speaker || "user",
                    timestamp: new Date(),
                };
                setTranscriptions((prev) => [...prev, newTranscription]);
            }

            // Handle recording status updates
            if (event.data.type === "recording-status") {
                setIsRecording(event.data.isRecording);
            }
        };

        window.addEventListener("message", handleTranscription);
        return () => window.removeEventListener("message", handleTranscription);
    }, []);

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
                            Voice Transcription
                        </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                        {isRecording ? (
                            <Mic className="w-4 h-4 text-red-500 animate-pulse" />
                        ) : (
                            <MicOff className="w-4 h-4 text-gray-400" />
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
                                Voice conversation will appear here
                            </p>
                            <p className="text-xs mt-1">
                                Start speaking to begin transcription
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

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>Live Voice Transcription</span>
                    <span>{transcriptions.length} messages</span>
                </div>
            </div>
        </div>
    );
};

export default ChatPanel;
