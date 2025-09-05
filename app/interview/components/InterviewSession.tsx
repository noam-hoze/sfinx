"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
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
    const searchParams = useSearchParams();
    const companyLogo = searchParams.get("logo") || "/meta-logo.png";
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
            <header className="border-b border-gray-200/30 dark:border-gray-700/30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl px-3 py-1">
                <div className="flex items-center justify-between max-w-8xl mx-auto">
                    {/* Left Section - Logo */}
                    <div className="flex items-center">
                        <img
                            src={companyLogo}
                            alt="Company Logo"
                            className="h-20 w-auto"
                        />
                    </div>

                    {/* Center Section - Title */}
                    <div className="flex-1 flex justify-center items-center">
                        <h1 className="text-xl font-medium text-gray-900 dark:text-white tracking-tight">
                            Front-end Developer Interview
                        </h1>
                    </div>

                    {/* Right Section - Controls */}
                    <div className="flex items-center space-x-4">
                        {/* Interview Control Buttons */}
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={() =>
                                    handleInterviewButtonClick("start")
                                }
                                disabled={isInterviewActive}
                                className="px-4 py-2 text-sm font-medium rounded-full bg-green-50 text-green-700 hover:bg-green-100 disabled:bg-gray-100 disabled:text-gray-400 transition-all duration-200 hover:shadow-sm disabled:hover:shadow-none disabled:cursor-not-allowed dark:bg-green-900/10 dark:text-green-400 dark:hover:bg-green-900/20"
                                title="Start Interview"
                            >
                                Start Interview
                            </button>
                            <button
                                onClick={() =>
                                    handleInterviewButtonClick("stop")
                                }
                                disabled={!isInterviewActive}
                                className="px-4 py-2 text-sm font-medium rounded-full bg-red-50 text-red-700 hover:bg-red-100 disabled:bg-gray-100 disabled:text-gray-400 transition-all duration-200 hover:shadow-sm disabled:hover:shadow-none disabled:cursor-not-allowed dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20"
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
                                className="px-4 py-2 text-sm font-medium rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 transition-all duration-200 hover:shadow-sm dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-700/70"
                                title="Show Sfinx Avatar"
                            >
                                Show Sfinx
                            </button>
                        )}
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
                        <div className="h-full flex flex-col border-t">
                            {/* Voice Controls (Top Quarter - 25%) */}
                            <div className="flex-[1] flex flex-col bg-white dark:bg-gray-800">
                                {/* Header */}
                                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                                Interviewer Status
                                            </h3>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Content */}
                                <div className="flex-1 p-4">
                                    <RealTimeConversation
                                        ref={realTimeConversationRef}
                                        isInterviewActive={isInterviewActive}
                                        onStartConversation={() =>
                                            console.log("Conversation started")
                                        }
                                        onEndConversation={() =>
                                            console.log("Conversation ended")
                                        }
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
