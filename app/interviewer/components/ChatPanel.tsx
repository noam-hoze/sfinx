"use client";

import React, { useState, useRef, useEffect } from "react";
import { TypeAnimation } from "react-type-animation";
import { Send, Bot, User } from "lucide-react";

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
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            type: "ai",
            content:
                "Hello! I'm your AI interviewer. Let's build a React counter component together. I'll guide you through the process and help you write clean, efficient code.",
            timestamp: new Date(),
        },
        {
            id: "2",
            type: "ai",
            content:
                "Start by creating a basic counter component with increment and decrement functionality. Feel free to ask me any questions along the way!",
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

    const handleSendMessage = () => {
        if (!currentMessage.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            type: "user",
            content: currentMessage,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setCurrentMessage("");
        onSendMessage?.(currentMessage);

        // Simulate AI response
        setIsTyping(true);
        setTimeout(() => {
            const aiResponse: Message = {
                id: (Date.now() + 1).toString(),
                type: "ai",
                content: getAIResponse(currentMessage),
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, aiResponse]);
            setIsTyping(false);
        }, 1000);
    };

    const getAIResponse = (userInput: string): string => {
        const input = userInput.toLowerCase();

        if (
            input.includes("bug") ||
            input.includes("fix") ||
            input.includes("error")
        ) {
            return "I can help you fix that! Let me analyze your code and suggest the improvements. Would you like me to apply the fix directly to your editor?";
        }

        if (input.includes("test") || input.includes("run")) {
            return "Great! Testing is important. I can see you've added a Run button. Let me help you add some basic tests for your counter component.";
        }

        if (input.includes("help") || input.includes("stuck")) {
            return "No worries! Let's break this down step by step. Here's what we need to implement for a solid counter component...";
        }

        return "That's a good question! Let me think about that and provide you with some guidance. Keep up the great work!";
    };

    const handleQuickAction = (action: string) => {
        if (action === "fix-bug") {
            onRequestCodeChange?.(
                "Fix the counter bug by adding proper state management"
            );
        } else if (action === "add-test") {
            onRequestCodeChange?.("Add unit tests for the counter component");
        } else if (action === "optimize") {
            onRequestCodeChange?.(
                "Optimize the counter component for better performance"
            );
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
                        Fix Bug
                    </button>
                    <button
                        onClick={() => handleQuickAction("add-test")}
                        className="px-3 py-1 text-xs bg-success-green text-white rounded hover:bg-green-600 transition-colors"
                    >
                        Add Tests
                    </button>
                    <button
                        onClick={() => handleQuickAction("optimize")}
                        className="px-3 py-1 text-xs bg-electric-blue text-white rounded hover:bg-blue-600 transition-colors"
                    >
                        Optimize
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
