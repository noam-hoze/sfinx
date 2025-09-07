"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import { Play, RotateCcw } from "lucide-react";
import CodePreview from "./CodePreview";

interface EditorPanelProps {
    showDiff?: boolean;
    originalCode?: string;
    modifiedCode?: string;
    currentCode?: string;
    onCodeChange?: (code: string) => void;
    onApplyChanges?: () => void;
    onRejectChanges?: () => void;
    isDarkMode?: boolean;
    availableTabs?: Array<"editor" | "preview">;
    activeTab?: "editor" | "preview";
    onTabSwitch?: (tab: "editor" | "preview") => void;
    onRunCode?: () => void;
    readOnly?: boolean;
    onElevenLabsUpdate?: (text: string) => Promise<void>;
    updateKBVariables?: (updates: any) => Promise<void>;
}

const EditorPanel: React.FC<EditorPanelProps> = ({
    showDiff = false,
    originalCode = "",
    modifiedCode = "",
    currentCode: propCurrentCode,
    onCodeChange,
    onApplyChanges,
    onRejectChanges,
    isDarkMode = false,
    availableTabs = ["editor"],
    activeTab = "editor",
    onTabSwitch,
    onRunCode,
    readOnly = false,
    onElevenLabsUpdate,
    updateKBVariables,
}) => {
    const [currentCode, setCurrentCode] = useState(propCurrentCode || "");

    // State for theme to avoid SSR issues
    const [editorTheme, setEditorTheme] = useState("sfinx-light");

    // Simple AI detection - no complex hooks needed

    // Refs for paste detection
    const previousCodeRef = useRef<string>(propCurrentCode || "");
    const lastChangeTimeRef = useRef<number>(0); // Start at 0 so first paste has large timeSinceLastChange
    const pasteStartTimeRef = useRef<number>(0);
    const lastPasteDetectionTimeRef = useRef<number>(0);

    // Update local state when prop changes
    useEffect(() => {
        if (propCurrentCode && propCurrentCode !== currentCode) {
            setCurrentCode(propCurrentCode);
            previousCodeRef.current = propCurrentCode;
            // Reset timestamp when code is first loaded
            lastChangeTimeRef.current = Date.now();
        }
    }, [propCurrentCode, currentCode]);

    // Removed complex AI detection updates - keeping it simple

    // Set theme on client side to avoid SSR issues
    useEffect(() => {
        const isDark = document.documentElement.classList.contains("dark");
        setEditorTheme(isDark ? "sfinx-dark" : "sfinx-light");
    }, []);

    const editorRef = useRef<any>(null);

    // Watch for dark mode changes and update Monaco theme
    useEffect(() => {
        const observer = new MutationObserver(() => {
            if (editorRef.current) {
                const isDark =
                    document.documentElement.classList.contains("dark");
                // Access Monaco through the editor instance
                const monaco = (window as any).monaco;
                if (monaco) {
                    monaco.editor.setTheme(
                        isDark ? "sfinx-dark" : "sfinx-light"
                    );
                }
            }
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => observer.disconnect();
    }, []);

    const handleEditorDidMount = (editor: any, monaco: any) => {
        editorRef.current = editor;

        // Initialize timestamps when editor is ready
        lastChangeTimeRef.current = Date.now();
        pasteStartTimeRef.current = Date.now();

        // Configure Monaco editor themes
        monaco.editor.defineTheme("sfinx-light", {
            base: "vs",
            inherit: true,
            rules: [],
            colors: {
                "editor.background": "#FAFAFA",
            },
        });

        monaco.editor.defineTheme("sfinx-dark", {
            base: "vs-dark",
            inherit: true,
            rules: [],
            colors: {
                "editor.background": "#1f2937", // gray-800
            },
        });

        // Check if dark mode is active on document
        const isDark = document.documentElement.classList.contains("dark");
        monaco.editor.setTheme(isDark ? "sfinx-dark" : "sfinx-light");
    };

    const handleCodeChange = useCallback(
        (value: string | undefined) => {
            if (value !== undefined) {
                const now = Date.now();
                const previousCode = previousCodeRef.current;

                // Calculate the change
                const charactersAdded = value.length - previousCode.length;

                // Update timestamp BEFORE calculating time since last change
                const previousTime = lastChangeTimeRef.current;
                const timeSinceLastChange = now - previousTime;

                // Simple AI detection: check if paste > 50 chars
                if (value.length > 50) {
                    console.log(
                        "🚨 Large paste detected - requesting state machine to set using_ai: true"
                    );
                    updateKBVariables?.({ using_ai: true });
                }

                // Update refs
                previousCodeRef.current = value;
                lastChangeTimeRef.current = now;
                if (charactersAdded > 10) {
                    pasteStartTimeRef.current = now;
                }

                setCurrentCode(value);
                onCodeChange?.(value);
            }
        },
        [onCodeChange, onElevenLabsUpdate]
    );

    const runCode = () => {
        // Trigger the preview tab creation and switching
        if (onRunCode) {
            onRunCode();
        }
    };

    if (showDiff) {
        return (
            <div className="h-full flex flex-col">
                {/* Diff Header */}
                <div
                    className={`border-b px-4 py-2 flex items-center justify-between transition-colors duration-300 ${
                        isDarkMode
                            ? "bg-gray-800 border-gray-700"
                            : "bg-white border-light-gray"
                    }`}
                >
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-warning-yellow rounded-full"></div>
                        <span
                            className={`text-sm font-medium ${
                                isDarkMode ? "text-white" : "text-deep-slate"
                            }`}
                        >
                            AI Suggested Changes
                        </span>
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={onRejectChanges}
                            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center"
                        >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Reject
                        </button>
                        <button
                            onClick={onApplyChanges}
                            className="px-3 py-1 text-sm bg-electric-blue text-white rounded hover:bg-blue-600 flex items-center"
                        >
                            Apply Changes
                        </button>
                    </div>
                </div>

                {/* Diff Editor */}
                <div className="flex-1">
                    <DiffEditor
                        height="100%"
                        language="javascript"
                        original={originalCode}
                        modified={modifiedCode}
                        theme={
                            document.documentElement.classList.contains("dark")
                                ? "sfinx-dark"
                                : "sfinx-light"
                        }
                        options={{
                            readOnly: true,
                            renderSideBySide: true,
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: "on",
                            renderWhitespace: "boundary",
                            scrollBeyondLastLine: false,
                        }}
                        onMount={handleEditorDidMount}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Editor Header */}
            <div className="border-b px-4 py-2 flex items-center justify-between bg-white border-light-gray dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                    {/* Tabs */}
                    {availableTabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => onTabSwitch?.(tab)}
                            className={`px-3 py-1 text-sm font-medium rounded ${
                                activeTab === tab
                                    ? "bg-gray-100 text-deep-slate dark:bg-gray-700 dark:text-white"
                                    : "text-gray-600 hover:text-deep-slate hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700"
                            }`}
                        >
                            {tab === "editor" ? "UserList.tsx" : "Preview"}
                        </button>
                    ))}
                </div>
                <button
                    onClick={runCode}
                    className="p-2 text-sm bg-[#2463eb] text-white rounded hover:bg-[#1d4ed8] transition-all duration-200 hover:shadow-sm transform hover:scale-[1.02] flex items-center dark:bg-[#2463eb] dark:hover:bg-[#1d4ed8]"
                    title="Run Code"
                >
                    <Play className="w-4 h-4" />
                </button>
            </div>

            {/* Dynamic Content */}
            <div className="flex-1">
                {activeTab === "editor" ? (
                    <Editor
                        height="100%"
                        language="javascript"
                        value={currentCode}
                        theme={editorTheme}
                        onChange={handleCodeChange}
                        onMount={handleEditorDidMount}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: "on",
                            renderWhitespace: "boundary",
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            wordWrap: "on",
                            tabSize: 2,
                            insertSpaces: true,
                            readOnly: readOnly,
                        }}
                    />
                ) : (
                    <CodePreview
                        code={currentCode}
                        isActive={activeTab === "preview"}
                        isDarkMode={isDarkMode}
                    />
                )}
            </div>
        </div>
    );
};

export default EditorPanel;
