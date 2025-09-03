"use client";

import React, { useState, useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Moon, Sun } from "lucide-react";
import EditorPanel from "./components/EditorPanel";
import ChatPanel from "./components/ChatPanel";

const AIInterviewerSession = () => {
    const [showDiff, setShowDiff] = useState(false);
    const [originalCode, setOriginalCode] = useState("");
    const [modifiedCode, setModifiedCode] = useState("");
    const [currentCode, setCurrentCode] = useState("");
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [availableTabs, setAvailableTabs] = useState<
        Array<"editor" | "preview">
    >(["editor"]);
    const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");

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

    // Mock function to simulate AI applying changes
    const simulateAIChange = () => {
        const buggedCode = currentCode.replace(
            "const [count, setCount] = useState(0);",
            "const [count, setCount] = useState(0); // Bug: missing dependency"
        );
        setOriginalCode(currentCode);
        setModifiedCode(buggedCode);
        setShowDiff(true);
    };

    const handleSendMessage = (message: string) => {
        console.log("User sent message:", message);
    };

    const handleRequestCodeChange = (change: string) => {
        console.log("AI requested code change:", change);
        // In a real implementation, this would trigger the AI to analyze and suggest changes
        simulateAIChange();
    };

    return (
        <div className="h-screen flex flex-col bg-soft-white text-deep-slate dark:bg-gray-900 dark:text-white">
            {/* Header */}
            <header className="border-b px-6 py-4 bg-white border-light-gray dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-deep-slate dark:text-white">
                            AI Interviewer Session
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Interactive coding interview with AI assistance
                        </p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-success-green rounded-full"></div>
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                                Session Active
                            </span>
                        </div>
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-md bg-light-gray text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-yellow-400 dark:hover:bg-gray-600"
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
                        <button
                            onClick={simulateAIChange}
                            className="px-3 py-1 text-xs rounded bg-electric-blue text-white hover:bg-blue-600"
                        >
                            Test AI Change
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden">
                <PanelGroup direction="horizontal">
                    {/* Left Panel - Editor */}
                    <Panel defaultSize={60} minSize={40}>
                        <div className="h-full border-r bg-white border-light-gray dark:bg-gray-800 dark:border-gray-700">
                            <EditorPanel
                                showDiff={showDiff}
                                originalCode={originalCode}
                                modifiedCode={modifiedCode}
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

                    {/* Right Panel - AI Chat */}
                    <Panel defaultSize={40} minSize={30}>
                        <div className="h-full bg-white dark:bg-gray-800">
                            <ChatPanel
                                onSendMessage={handleSendMessage}
                                onRequestCodeChange={handleRequestCodeChange}
                                isDarkMode={isDarkMode}
                            />
                        </div>
                    </Panel>
                </PanelGroup>
            </div>
        </div>
    );
};

export default AIInterviewerSession;
