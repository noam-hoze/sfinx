"use client";

import React, { useState, useRef } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import { Play, RotateCcw } from "lucide-react";

interface EditorPanelProps {
    showDiff?: boolean;
    originalCode?: string;
    modifiedCode?: string;
    onCodeChange?: (code: string) => void;
    onApplyChanges?: () => void;
    onRejectChanges?: () => void;
    isDarkMode?: boolean;
}

const EditorPanel: React.FC<EditorPanelProps> = ({
    showDiff = false,
    originalCode = "",
    modifiedCode = "",
    onCodeChange,
    onApplyChanges,
    onRejectChanges,
    isDarkMode = false,
}) => {
    const [currentCode, setCurrentCode] =
        useState(`// Welcome to the AI Interviewer Session!
// This is a React component for a counter application.

import React, { useState } from 'react';

const Counter = () => {
    const [count, setCount] = useState(0);

    const increment = () => {
        setCount(count + 1);
    };

    const decrement = () => {
        setCount(count - 1);
    };

    return (
        <div className="counter">
            <h1>Counter: {count}</h1>
            <button onClick={increment}>+</button>
            <button onClick={decrement}>-</button>
        </div>
    );
};

export default Counter;`);

    const editorRef = useRef<any>(null);

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

        monaco.editor.setTheme(isDarkMode ? "sfinx-dark" : "sfinx-light");
    };

    const handleCodeChange = (value: string | undefined) => {
        if (value !== undefined) {
            setCurrentCode(value);
            onCodeChange?.(value);
        }
    };

    const runCode = () => {
        // Simulate running the code
        console.log("Running code:", currentCode);
        // In a real implementation, this would execute the code
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
                        theme={isDarkMode ? "sfinx-dark" : "sfinx-light"}
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
            <div
                className={`border-b px-4 py-2 flex items-center justify-between transition-colors duration-300 ${
                    isDarkMode
                        ? "bg-gray-800 border-gray-700"
                        : "bg-white border-light-gray"
                }`}
            >
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-success-green rounded-full"></div>
                    <span
                        className={`text-sm font-medium ${
                            isDarkMode ? "text-white" : "text-deep-slate"
                        }`}
                    >
                        Counter.tsx
                    </span>
                </div>
                <button
                    onClick={runCode}
                    className="px-3 py-1 text-sm bg-electric-blue text-white rounded hover:bg-blue-600 flex items-center"
                >
                    <Play className="w-4 h-4 mr-1" />
                    Run
                </button>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1">
                <Editor
                    height="100%"
                    language="javascript"
                    value={currentCode}
                    theme={isDarkMode ? "sfinx-dark" : "sfinx-light"}
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
            </div>
        </div>
    );
};

export default EditorPanel;
