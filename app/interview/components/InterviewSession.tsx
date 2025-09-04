"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Moon, Sun } from "lucide-react";
import EditorPanel from "./editor/EditorPanel";
import ChatPanel from "./chat/ChatPanel";
import RealTimeConversation from "./chat/RealTimeConversation";
import {
    InterviewProvider,
    useInterview,
    BUGGY_COUNTER_CODE,
} from "../../../lib/interview";
import AvatarManager from "./avatar/AvatarManager";

const InterviewerContent = () => {
    const { state, getCurrentTask, showAvatar, updateAvatarPosition } =
        useInterview();
    const [showDiff, setShowDiff] = useState(false);
    const [originalCode, setOriginalCode] = useState("");
    const [modifiedCode, setModifiedCode] = useState("");
    const [currentCode, setCurrentCode] = useState(getInitialCode());
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [availableTabs, setAvailableTabs] = useState<
        Array<"editor" | "preview">
    >(["editor"]);
    const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
    const [isAISpeaking, setIsAISpeaking] = useState(false);
    const [isInterviewActive, setIsInterviewActive] = useState(false);
    const realTimeConversationRef = useRef<any>(null);

    const handleInterviewButtonClick = useCallback(
        async (action: "start" | "stop") => {
            if (action === "start") {
                try {
                    await realTimeConversationRef.current?.startConversation();
                    setIsInterviewActive(true);
                } catch (error) {
                    console.error("Failed to start interview:", error);
                }
            } else {
                try {
                    await realTimeConversationRef.current?.stopConversation();
                    setIsInterviewActive(false);
                } catch (error) {
                    console.error("Failed to stop interview:", error);
                }
            }
        },
        []
    );

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

    // Update code when task changes
    useEffect(() => {
        const currentTask = getCurrentTask();
        if (currentTask?.id === "task2-counter-debug") {
            setCurrentCode(BUGGY_COUNTER_CODE);
        } else if (currentTask?.id === "task1-userlist") {
            setCurrentCode(getInitialCode());
        }
    }, [state.currentTaskId, getCurrentTask]);

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

    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
    };

    const handleCodeChange = (code: string) => {
        setCurrentCode(code);
    };

    const handleApplyChanges = () => {
        setCurrentCode(modifiedCode);
        setShowDiff(false);
    };

    const handleRejectChanges = () => {
        setShowDiff(false);
    };

    // Handle avatar speaking messages
    useEffect(() => {
        const handleAvatarSpeaking = (event: MessageEvent) => {
            if (event.data.type === "avatar-speaking") {
                setIsAISpeaking(true);
                setTimeout(() => setIsAISpeaking(false), event.data.duration);
            }
        };

        window.addEventListener("message", handleAvatarSpeaking);
        return () =>
            window.removeEventListener("message", handleAvatarSpeaking);
    }, []);

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

    const updateCodeForTask = (taskId: string) => {
        if (taskId === "task2-counter-debug") {
            setCurrentCode(BUGGY_COUNTER_CODE);
        } else if (taskId === "task1-userlist") {
            setCurrentCode(getInitialCode());
        }
    };

    return (
        <div className="h-screen flex flex-col bg-soft-white text-deep-slate dark:bg-gray-900 dark:text-white">
            {/* Header */}
            <header className="border-b border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl px-6 py-5">
                <div className="flex items-center justify-between">
                    {/* Left Section - Title */}
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
                            Front-end Developer Interview
                        </h1>
                    </div>

                    {/* Right Section - Controls */}
                    <div className="flex items-center space-x-3">
                        {/* Interview Control Buttons */}
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() =>
                                    handleInterviewButtonClick("start")
                                }
                                disabled={isInterviewActive}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-green-100 text-green-800 hover:bg-green-200 disabled:bg-gray-300 disabled:text-gray-500 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-[1.02] disabled:hover:scale-100 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-800/30"
                                title="Start Interview"
                            >
                                Start Interview
                            </button>
                            <button
                                onClick={() =>
                                    handleInterviewButtonClick("stop")
                                }
                                disabled={!isInterviewActive}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-100 text-red-800 hover:bg-red-200 disabled:bg-gray-300 disabled:text-gray-500 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-[1.02] disabled:hover:scale-100 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-800/30"
                                title="Stop Interview"
                            >
                                Stop Interview
                            </button>
                        </div>

                        {!state.avatarVisible && (
                            <button
                                onClick={() => {
                                    // Reset to default position when showing
                                    const defaultX =
                                        typeof window !== "undefined"
                                            ? window.innerWidth - 400
                                            : 800;
                                    const defaultY = 100;
                                    updateAvatarPosition(defaultX, defaultY);
                                    showAvatar();
                                }}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-[1.02] dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                title="Show Sfinx Avatar"
                            >
                                Show Sfinx
                            </button>
                        )}
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105"
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
            <div className="flex-1 overflow-hidden">
                <PanelGroup direction="horizontal">
                    {/* Middle Panel - Editor */}
                    <Panel defaultSize={70} minSize={50}>
                        <div className="h-full border-r bg-white border-light-gray dark:bg-gray-800 dark:border-gray-700">
                            <EditorPanel
                                showDiff={showDiff}
                                originalCode={originalCode}
                                modifiedCode={modifiedCode}
                                currentCode={currentCode}
                                onCodeChange={handleCodeChange}
                                onApplyChanges={handleApplyChanges}
                                onRejectChanges={handleRejectChanges}
                                isDarkMode={isDarkMode}
                                availableTabs={availableTabs}
                                activeTab={activeTab}
                                onTabSwitch={handleTabSwitch}
                                onRunCode={handleRunCode}
                            />
                        </div>
                    </Panel>

                    <PanelResizeHandle className="w-2 bg-light-gray hover:bg-electric-blue dark:bg-gray-600 dark:hover:bg-gray-500" />

                    {/* Right Panel - Voice Controls & Transcription */}
                    <Panel defaultSize={30} minSize={25}>
                        <div className="h-full flex flex-col">
                            {/* Voice Controls (Top Half) */}
                            <div className="flex-1 border-b border-gray-200 dark:border-gray-700">
                                <RealTimeConversation
                                    ref={realTimeConversationRef}
                                    onStartConversation={() =>
                                        console.log("Conversation started")
                                    }
                                    onEndConversation={() =>
                                        console.log("Conversation ended")
                                    }
                                />
                            </div>

                            {/* Transcription Display (Bottom Half) */}
                            <div className="flex-1">
                                <ChatPanel />
                            </div>
                        </div>
                    </Panel>
                </PanelGroup>
            </div>

            {/* Draggable Avatar */}
            <AvatarManager />
        </div>
    );
};

const InterviewSession = () => {
    return (
        <InterviewProvider>
            <InterviewerContent />
        </InterviewProvider>
    );
};

export default InterviewSession;
