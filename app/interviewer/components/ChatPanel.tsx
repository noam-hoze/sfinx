"use client";

import React, { useState, useRef, useEffect } from "react";
import { TypeAnimation } from "react-type-animation";
import { Send, Bot, User } from "lucide-react";
import { useInterview } from "../../../lib/interview/context";
import {
    sendToOpenAI,
    buildSystemPrompt,
    convertInterviewMessagesToOpenAI,
} from "../../../lib/interview/openai";
import { InterviewMessage } from "../../../lib/interview/types";

interface Message {
    id: string;
    type: "ai" | "user";
    content: string;
    timestamp: Date;
}

interface ChatPanelProps {
    onSendMessage?: (message: string) => void;
    onRequestCodeChange?: (change: string) => void;
    isDarkMode?: boolean;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
    onSendMessage,
    onRequestCodeChange,
    isDarkMode = false,
}) => {
    const {
        state,
        getCurrentTask,
        startInterview,
        nextTask,
        updateTaskStatus,
        startAvatarSpeaking,
        stopAvatarSpeaking,
    } = useInterview();

    // TTS function with lip sync
    const playTTS = async (text: string) => {
        try {
            const response = await fetch("/api/tts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ text }),
            });

            if (response.ok) {
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);

                // Start avatar speaking animation
                startAvatarSpeaking();

                // Set up audio event handlers
                audio.onended = () => {
                    console.log("🎭 Audio ended, stopping avatar speaking");
                    stopAvatarSpeaking();
                    URL.revokeObjectURL(audioUrl);
                };

                audio.onerror = () => {
                    console.log("🎭 Audio error, stopping avatar speaking");
                    stopAvatarSpeaking();
                    URL.revokeObjectURL(audioUrl);
                };

                // Also listen for pause event as a backup
                audio.onpause = () => {
                    console.log("🎭 Audio paused, stopping avatar speaking");
                    stopAvatarSpeaking();
                };

                // Play the audio
                await audio.play();
            } else {
                console.warn("TTS request failed:", response.status);
            }
        } catch (error) {
            console.warn("TTS playback failed:", error);
            stopAvatarSpeaking(); // Stop speaking on error
            // Continue without TTS - don't break the chat flow
        }
    };

    const [messages, setMessages] = useState<InterviewMessage[]>([
        {
            id: "1",
            type: "ai",
            content:
                "Hello! I'm Sfinx, your AI coding interviewer. I'm here to guide you through some practical coding challenges and help you demonstrate your skills.",
            timestamp: new Date(),
        },
        {
            id: "2",
            type: "ai",
            content:
                "Let's get started! Your first task is to build a UserList React component that fetches users from an API and displays their information. You can see the requirements and starting code in the editor. Feel free to ask me questions as you work through this challenge!",
            timestamp: new Date(),
        },
    ]);

    const [currentMessage, setCurrentMessage] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async () => {
        if (!currentMessage.trim()) return;

        const userMessage: InterviewMessage = {
            id: Date.now().toString(),
            type: "user",
            content: currentMessage,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setCurrentMessage("");
        onSendMessage?.(currentMessage);

        // Start interview if not already started
        if (!state.isActive) {
            startInterview();
        }

        // Get AI response using OpenAI
        setIsTyping(true);
        try {
            const currentTask = getCurrentTask();
            const systemPrompt = buildSystemPrompt(currentTask);

            // Convert messages to OpenAI format
            const openaiMessages = convertInterviewMessagesToOpenAI([
                ...messages,
                userMessage,
            ]);

            const aiResponseContent = await sendToOpenAI(
                openaiMessages,
                systemPrompt
            );

            const aiResponse: InterviewMessage = {
                id: (Date.now() + 1).toString(),
                type: "ai",
                content: aiResponseContent,
                timestamp: new Date(),
                taskId: currentTask?.id,
            };

            setMessages((prev) => [...prev, aiResponse]);

            // Generate and play TTS audio
            await playTTS(aiResponseContent);

            // Trigger speaking animation for avatar (this will be passed up to parent)
            if (window.parent) {
                window.parent.postMessage(
                    {
                        type: "avatar-speaking",
                        duration: Math.max(2000, aiResponseContent.length * 50),
                    },
                    "*"
                );
            }
        } catch (error) {
            console.error("Error getting AI response:", error);
            const errorMessage: InterviewMessage = {
                id: (Date.now() + 1).toString(),
                type: "ai",
                content: "Sorry, I encountered an error. Please try again.",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleQuickAction = (action: string) => {
        const currentTask = getCurrentTask();

        if (action === "fix-bug") {
            if (currentTask?.id === "task2-counter-debug") {
                onRequestCodeChange?.(
                    "The counter component has a state management issue. Can you identify and fix it?"
                );
            } else {
                onRequestCodeChange?.("Let me help you debug this issue");
            }
        } else if (action === "next-task") {
            if (currentTask) {
                updateTaskStatus(currentTask.id, "completed");
                nextTask();
                setCurrentMessage(
                    `I've completed ${currentTask.title}. What's next?`
                );
            }
        } else if (action === "hint") {
            setCurrentMessage("Can you give me a hint for the current task?");
        }
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-gray-800">
            {/* Chat Header */}
            <div className="border-b px-4 py-3 bg-white border-light-gray dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                    <Bot className="w-5 h-5 text-electric-blue" />
                    <h3 className="text-sm font-semibold text-deep-slate dark:text-white">
                        AI Interviewer
                    </h3>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${
                            message.type === "user"
                                ? "justify-end"
                                : "justify-start"
                        }`}
                    >
                        <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                message.type === "user"
                                    ? "bg-electric-blue text-white"
                                    : "bg-light-gray text-deep-slate dark:bg-gray-700 dark:text-white"
                            }`}
                        >
                            <div className="flex items-center space-x-2 mb-1">
                                {message.type === "ai" ? (
                                    <Bot className="w-4 h-4" />
                                ) : (
                                    <User className="w-4 h-4" />
                                )}
                                <span className="text-xs opacity-75">
                                    {message.type === "ai" ? "AI" : "You"}
                                </span>
                            </div>
                            <p className="text-sm">{message.content}</p>
                        </div>
                    </div>
                ))}

                {/* Typing Indicator */}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="px-4 py-2 rounded-lg bg-light-gray dark:bg-gray-700">
                            <div className="flex items-center space-x-2">
                                <Bot className="w-4 h-4" />
                                <span className="text-xs text-gray-600 dark:text-gray-300">
                                    AI is typing
                                </span>
                                <div className="flex space-x-1">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div
                                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                        style={{ animationDelay: "0.1s" }}
                                    ></div>
                                    <div
                                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                        style={{ animationDelay: "0.2s" }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            <div className="px-4 py-2 border-t border-light-gray dark:border-gray-700">
                <div className="flex space-x-2">
                    <button
                        onClick={() => handleQuickAction("fix-bug")}
                        className="px-3 py-1 text-xs bg-warning-yellow text-white rounded hover:bg-yellow-600 transition-colors"
                    >
                        Debug
                    </button>
                    <button
                        onClick={() => handleQuickAction("hint")}
                        className="px-3 py-1 text-xs bg-success-green text-white rounded hover:bg-green-600 transition-colors"
                    >
                        Hint
                    </button>
                    <button
                        onClick={() => handleQuickAction("next-task")}
                        className="px-3 py-1 text-xs bg-electric-blue text-white rounded hover:bg-blue-600 transition-colors"
                    >
                        Next Task
                    </button>
                </div>
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-light-gray dark:border-gray-700">
                <div className="flex space-x-2">
                    <input
                        type="text"
                        value={currentMessage}
                        onChange={(e) => setCurrentMessage(e.target.value)}
                        onKeyPress={(e) =>
                            e.key === "Enter" && handleSendMessage()
                        }
                        placeholder="Ask me anything about your code..."
                        className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-electric-blue focus:border-transparent text-sm border-light-gray bg-white text-deep-slate dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!currentMessage.trim()}
                        className="px-3 py-2 bg-electric-blue text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatPanel;
