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

    // Load theme preference from localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem("sfinx-theme");
        if (savedTheme === "dark") {
            setIsDarkMode(true);
        }
    }, []);

    // Save theme preference to localStorage
    useEffect(() => {
        localStorage.setItem("sfinx-theme", isDarkMode ? "dark" : "light");
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
        <div
            className={`h-screen flex flex-col transition-colors duration-300 ${
                isDarkMode
                    ? "bg-gray-900 text-white"
                    : "bg-soft-white text-deep-slate"
            }`}
        >
            {/* Header */}
            <header
                className={`border-b px-6 py-4 transition-colors duration-300 ${
                    isDarkMode
                        ? "bg-gray-800 border-gray-700"
                        : "bg-white border-light-gray"
                }`}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h1
                            className={`text-2xl font-bold ${
                                isDarkMode ? "text-white" : "text-deep-slate"
                            }`}
                        >
                            AI Interviewer Session
                        </h1>
                        <p
                            className={`text-sm ${
                                isDarkMode ? "text-gray-300" : "text-gray-600"
                            }`}
                        >
                            Interactive coding interview with AI assistance
                        </p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-success-green rounded-full"></div>
                            <span
                                className={`text-sm ${
                                    isDarkMode
                                        ? "text-gray-300"
                                        : "text-gray-600"
                                }`}
                            >
                                Session Active
                            </span>
                        </div>
                        <button
                            onClick={toggleTheme}
                            className={`p-2 rounded-md transition-colors ${
                                isDarkMode
                                    ? "bg-gray-700 text-yellow-400 hover:bg-gray-600"
                                    : "bg-light-gray text-gray-600 hover:bg-gray-200"
                            }`}
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
                            className={`px-3 py-1 text-xs rounded transition-colors ${
                                isDarkMode
                                    ? "bg-electric-blue text-white hover:bg-blue-600"
                                    : "bg-electric-blue text-white hover:bg-blue-600"
                            }`}
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
                        <div
                            className={`h-full border-r transition-colors duration-300 ${
                                isDarkMode
                                    ? "bg-gray-800 border-gray-700"
                                    : "bg-white border-light-gray"
                            }`}
                        >
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

                    <PanelResizeHandle
                        className={`w-2 transition-colors duration-300 ${
                            isDarkMode
                                ? "bg-gray-600 hover:bg-gray-500"
                                : "bg-light-gray hover:bg-electric-blue"
                        }`}
                    />

                    {/* Right Panel - AI Chat */}
                    <Panel defaultSize={40} minSize={30}>
                        <div
                            className={`h-full transition-colors duration-300 ${
                                isDarkMode ? "bg-gray-800" : "bg-white"
                            }`}
                        >
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
