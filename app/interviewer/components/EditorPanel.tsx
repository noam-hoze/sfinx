"use client";

import React, { useState, useRef, useEffect } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import { Play, RotateCcw } from "lucide-react";
import CodePreview from "./CodePreview";

interface EditorPanelProps {
    showDiff?: boolean;
    originalCode?: string;
    modifiedCode?: string;
    onCodeChange?: (code: string) => void;
    onApplyChanges?: () => void;
    onRejectChanges?: () => void;
    isDarkMode?: boolean;
    availableTabs?: Array<"editor" | "preview">;
    activeTab?: "editor" | "preview";
    onTabSwitch?: (tab: "editor" | "preview") => void;
    onRunCode?: () => void;
}

const EditorPanel: React.FC<EditorPanelProps> = ({
    showDiff = false,
    originalCode = "",
    modifiedCode = "",
    onCodeChange,
    onApplyChanges,
    onRejectChanges,
    isDarkMode = false,
    availableTabs = ["editor"],
    activeTab = "editor",
    onTabSwitch,
    onRunCode,
}) => {
    const [currentCode, setCurrentCode] = useState(`const Counter = () => {
    const [count, setCount] = React.useState(0);

    const increment = () => {
        setCount(count + 1);
    };

    const decrement = () => {
        setCount(count - 1);
    };

    return (
        <div className="p-8 text-center">
            <h1 className="text-3xl font-bold mb-4 text-gray-800">Counter: {count}</h1>
            <div className="space-x-4">
                <button
                    onClick={decrement}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                    -
                </button>
                <button
                    onClick={increment}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                    +
                </button>
            </div>
        </div>
    );
};

render(Counter);`);

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

    const handleCodeChange = (value: string | undefined) => {
        if (value !== undefined) {
            setCurrentCode(value);
            onCodeChange?.(value);
        }
    };

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
                            {tab === "editor" ? "Counter.tsx" : "Preview"}
                        </button>
                    ))}
                </div>
                <button
                    onClick={runCode}
                    className="px-3 py-1 text-sm bg-electric-blue text-white rounded hover:bg-blue-600 flex items-center"
                >
                    <Play className="w-4 h-4 mr-1" />
                    Run
                </button>
            </div>

            {/* Dynamic Content */}
            <div className="flex-1">
                {activeTab === "editor" ? (
                    <Editor
                        height="100%"
                        language="javascript"
                        value={currentCode}
                        theme={
                            document.documentElement.classList.contains("dark")
                                ? "sfinx-dark"
                                : "sfinx-light"
                        }
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
