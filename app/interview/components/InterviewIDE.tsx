"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Moon, Sun } from "lucide-react";
import Image from "next/image";
import EditorPanel from "./editor/EditorPanel";
import ChatPanel from "./chat/ChatPanel";
import RealTimeConversation from "./chat/RealTimeConversation";
import { InterviewProvider, useInterview } from "../../../lib";

const InterviewerContent = () => {
    const { state, getCurrentTask, updateCurrentCode, updateSubmission } =
        useInterview();
    const searchParams = useSearchParams();
    const companyLogo = searchParams.get("logo") || "/meta-logo.png";
    const [showDiff, setShowDiff] = useState(false);
    const [originalCode, setOriginalCode] = useState("");
    const [modifiedCode, setModifiedCode] = useState("");
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [availableTabs, setAvailableTabs] = useState<
        Array<"editor" | "preview">
    >(["editor"]);
    const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
    const [isAISpeaking, setIsAISpeaking] = useState(false);
    const [isInterviewActive, setIsInterviewActive] = useState(false);
    const [isAgentConnected, setIsAgentConnected] = useState(false);
    const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes in seconds
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(
        null
    );
    const [isCodingStarted, setIsCodingStarted] = useState(false);
    const realTimeConversationRef = useRef<any>(null);

    const handleInterviewButtonClick = useCallback(
        async (action: "start" | "stop") => {
            if (action === "start") {
                try {
                    // Clear chat panel before starting new interview
                    window.postMessage({ type: "clear-chat" }, "*");
                    await realTimeConversationRef.current?.startConversation();
                    setIsInterviewActive(true);
                } catch (error) {
                    console.error("Failed to start interview:", error);
                }
            } else {
                try {
                    await realTimeConversationRef.current?.stopConversation();
                    setIsInterviewActive(false);
                    setIsAgentConnected(false);
                    setIsTimerRunning(false);
                    setIsCodingStarted(false);

                    // Clean up timer interval
                    if (timerInterval) {
                        clearInterval(timerInterval);
                        setTimerInterval(null);
                    }
                } catch (error) {
                    console.error("Failed to stop interview:", error);
                }
            }
        },
        [timerInterval]
    );

    const handleStartCoding = async () => {
        setTimeLeft(30 * 60); // Reset to 30 minutes
        setIsTimerRunning(true);
        setIsCodingStarted(true);

        // Send is_coding status to ElevenLabs KB
        if (realTimeConversationRef.current) {
            const kb = {
                is_coding: true,
            };
            const text = `KB_UPDATE: ${JSON.stringify(kb)}`;
            try {
                await realTimeConversationRef.current.sendContextualUpdate(
                    text
                );
                console.log("✅ Coding status sent to ElevenLabs KB");
            } catch (error) {
                console.error(
                    "❌ Failed to send coding status to ElevenLabs KB:",
                    error
                );
            }
        }

        // Start timer only when user clicks
        const interval = setInterval(async () => {
            setTimeLeft((time) => {
                if (time <= 1) {
                    // Time's up - cleanup
                    setIsTimerRunning(false);
                    setIsCodingStarted(false);

                    // Send coding stopped status when time expires
                    if (realTimeConversationRef.current) {
                        const kb = {
                            is_coding: false,
                        };
                        const text = `KB_UPDATE: ${JSON.stringify(kb)}`;
                        realTimeConversationRef.current
                            .sendContextualUpdate(text)
                            .then(() =>
                                console.log(
                                    "✅ Timer expired - coding stopped status sent to ElevenLabs KB"
                                )
                            )
                            .catch((error: any) =>
                                console.error(
                                    "❌ Failed to send timer expired status to ElevenLabs KB:",
                                    error
                                )
                            );
                    }

                    clearInterval(interval);
                    return 0;
                }
                return time - 1;
            });
        }, 1000);

        setTimerInterval(interval);
    };

    const handleStopCoding = async () => {
        setIsTimerRunning(false);
        setIsCodingStarted(false);

        // Send is_coding status to ElevenLabs KB
        if (realTimeConversationRef.current) {
            const kb = {
                is_coding: false,
            };
            const text = `KB_UPDATE: ${JSON.stringify(kb)}`;
            try {
                await realTimeConversationRef.current.sendContextualUpdate(
                    text
                );
                console.log("✅ Coding stopped status sent to ElevenLabs KB");
            } catch (error) {
                console.error(
                    "❌ Failed to send coding stopped status to ElevenLabs KB:",
                    error
                );
            }
        }

        // Clear timer interval
        if (timerInterval) {
            clearInterval(timerInterval);
            setTimerInterval(null);
        }
    };

    const handleSubmit = async () => {
        try {
            // Update local state
            updateSubmission(state.currentCode);

            // Send submission to ElevenLabs KB
            if (realTimeConversationRef.current) {
                const kb = {
                    submission: state.currentCode,
                    has_submitted: "true",
                    is_coding: false,
                };
                const text = `KB_UPDATE: ${JSON.stringify(kb)}`;
                await realTimeConversationRef.current.sendContextualUpdate(
                    text
                );
                console.log("✅ Submission sent to ElevenLabs KB");
            }

            setIsTimerRunning(false);
            setIsCodingStarted(false);
        } catch (error) {
            console.error("❌ Failed to submit solution:", error);
        }
    };

    function getInitialCode(): string {
        return `// Welcome to your coding interview!
// Create a UserList component that fetches users from an API

const UserList = () => {
    // Fetch users from: https://jsonplaceholder.typicode.com/users
    // Display name and email for each user
    // Add loading and error states

    return (
        <div>
            <h2>User List</h2>
            {/* Implement your user list here */}
        </div>
    );
};

render(UserList);`;
    }

    // Initialize code on first load
    useEffect(() => {
        if (!state.currentCode) {
            updateCurrentCode(getInitialCode());
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Update code when task changes
    useEffect(() => {
        const currentTask = getCurrentTask();
        if (currentTask?.id === "task1-userlist") {
            updateCurrentCode(getInitialCode());
        }
    }, [state.currentTaskId, getCurrentTask]); // eslint-disable-line react-hooks/exhaustive-deps

    // Load theme preference and apply to document
    useEffect(() => {
        const savedTheme = localStorage.getItem("sfinx-theme");
        const shouldBeDark = savedTheme === "dark";
        setIsDarkMode(shouldBeDark);

        const root = document.documentElement;
        if (shouldBeDark) {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }, []);

    // Save theme preference and apply to document
    useEffect(() => {
        localStorage.setItem("sfinx-theme", isDarkMode ? "dark" : "light");

        const root = document.documentElement;
        if (isDarkMode) {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }, [isDarkMode]);

    // Format time helper
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs
            .toString()
            .padStart(2, "0")}`;
    };

    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
    };

    const handleCodeChange = (code: string) => {
        updateCurrentCode(code);
    };

    const handleApplyChanges = () => {
        updateCurrentCode(modifiedCode);
        setShowDiff(false);
    };

    const handleRejectChanges = () => {
        setShowDiff(false);
    };

    const handleRunCode = () => {
        if (!availableTabs.includes("preview")) {
            setAvailableTabs([...availableTabs, "preview"]);
        }
        setActiveTab("preview");
    };

    const handleTabSwitch = (tab: "editor" | "preview") => {
        if (availableTabs.includes(tab)) {
            setActiveTab(tab);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-soft-white text-deep-slate dark:bg-gray-900 dark:text-white">
            {/* Header */}
            <header className="border-b border-gray-200/30 dark:border-gray-700/30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl px-3 py-1">
                <div className="flex items-center justify-between max-w-8xl mx-auto">
                    {/* Left Section - Logo */}
                    <div className="flex items-center">
                        <div className="relative h-20 w-20">
                            <Image
                                src={companyLogo}
                                alt="Company Logo"
                                fill
                                sizes="80px"
                                className="object-contain"
                            />
                        </div>
                    </div>

                    {/* Center Section - Title */}
                    <div className="flex-1 flex justify-center items-center">
                        <h1 className="text-xl font-medium text-gray-900 dark:text-white tracking-tight">
                            Front-end Developer Interview
                        </h1>
                    </div>

                    {/* Right Section - Controls */}
                    <div className="flex items-center space-x-4">
                        {/* Timer Display */}
                        {isCodingStarted && (
                            <div
                                className={`px-3 py-2 rounded-full font-mono text-sm font-semibold ${
                                    timeLeft < 300 // Less than 5 minutes
                                        ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                                }`}
                            >
                                {formatTime(timeLeft)}
                            </div>
                        )}

                        {/* Coding Control Button */}
                        <button
                            onClick={
                                isCodingStarted
                                    ? handleSubmit
                                    : handleStartCoding
                            }
                            disabled={!isInterviewActive && !isCodingStarted}
                            className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 hover:shadow-sm ${
                                isCodingStarted
                                    ? "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/10 dark:text-green-400 dark:hover:bg-green-900/20"
                                    : "bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/10 dark:text-purple-400 dark:hover:bg-purple-900/20"
                            } ${
                                !isInterviewActive && !isCodingStarted
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                            }`}
                            title={
                                isCodingStarted
                                    ? "Submit your solution"
                                    : isInterviewActive
                                    ? "Start 30-minute coding timer"
                                    : "Start interview first"
                            }
                        >
                            {isCodingStarted ? "Submit" : "Start Coding"}
                        </button>

                        {/* Interview Control Button */}
                        <button
                            onClick={() =>
                                handleInterviewButtonClick(
                                    isInterviewActive ? "stop" : "start"
                                )
                            }
                            className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 hover:shadow-sm ${
                                isInterviewActive
                                    ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20"
                                    : "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/10 dark:text-green-400 dark:hover:bg-green-900/20"
                            }`}
                            title={
                                isInterviewActive
                                    ? "Stop Interview"
                                    : "Start Interview"
                            }
                        >
                            {isInterviewActive
                                ? "Stop Interview"
                                : "Start Interview"}
                        </button>
                        <button
                            onClick={toggleTheme}
                            className="p-2.5 rounded-full bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-all duration-200 hover:shadow-sm"
                            title={
                                isDarkMode
                                    ? "Switch to Light Mode"
                                    : "Switch to Dark Mode"
                            }
                        >
                            {isDarkMode ? (
                                <Sun className="w-5 h-5" />
                            ) : (
                                <Moon className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden mt-6">
                <PanelGroup direction="horizontal">
                    {/* Middle Panel - Editor */}
                    <Panel defaultSize={70} minSize={50}>
                        <div className="h-full border-r bg-white border-light-gray dark:bg-gray-800 dark:border-gray-700">
                            <EditorPanel
                                showDiff={showDiff}
                                originalCode={originalCode}
                                modifiedCode={modifiedCode}
                                currentCode={state.currentCode}
                                onCodeChange={handleCodeChange}
                                onApplyChanges={handleApplyChanges}
                                onRejectChanges={handleRejectChanges}
                                isDarkMode={isDarkMode}
                                availableTabs={availableTabs}
                                activeTab={activeTab}
                                onTabSwitch={handleTabSwitch}
                                onRunCode={handleRunCode}
                                readOnly={!isCodingStarted}
                            />
                        </div>
                    </Panel>

                    <PanelResizeHandle className="w-2 bg-light-gray hover:bg-electric-blue dark:bg-gray-600 dark:hover:bg-gray-500" />

                    {/* Right Panel - Voice Controls & Transcription */}
                    <Panel defaultSize={30} minSize={25}>
                        <div className="h-full flex flex-col border-t">
                            {/* Voice Controls (Top Quarter - 25%) */}
                            <div className="flex-[1] flex flex-col bg-white dark:bg-gray-800">
                                {/* Header */}
                                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <div
                                                className={`w-2 h-2 rounded-full ${
                                                    isInterviewActive &&
                                                    isAgentConnected
                                                        ? "bg-green-500"
                                                        : "bg-red-500"
                                                }`}
                                            ></div>
                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                                Carrey
                                            </h3>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Content */}
                                <div className="flex-1 p-4">
                                    <RealTimeConversation
                                        ref={realTimeConversationRef}
                                        isInterviewActive={isInterviewActive}
                                        onStartConversation={() => {
                                            console.log("Conversation started");
                                            setIsAgentConnected(true);
                                        }}
                                        onEndConversation={() => {
                                            console.log("Conversation ended");
                                            setIsAgentConnected(false);
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Transcription Display (Bottom Three Quarters - 75%) */}
                            <div className="flex-[3] h-full overflow-hidden">
                                <ChatPanel />
                            </div>
                        </div>
                    </Panel>
                </PanelGroup>
            </div>
        </div>
    );
};

const InterviewIDE = () => {
    return (
        <InterviewProvider>
            <InterviewerContent />
        </InterviewProvider>
    );
};

export default InterviewIDE;
