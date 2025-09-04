"use client";

import React, { useState, useEffect } from "react";
import { LiveProvider, LiveError, LivePreview } from "react-live";

interface CodePreviewProps {
    code: string;
    isActive: boolean;
    isDarkMode?: boolean;
}

const CodePreview: React.FC<CodePreviewProps> = ({
    code,
    isActive,
    isDarkMode = false,
}) => {
    const [isExecuting, setIsExecuting] = useState(false);
    const [executionStatus, setExecutionStatus] = useState<
        "idle" | "success" | "error"
    >("idle");

    useEffect(() => {
        if (isActive && code) {
            setIsExecuting(true);
            setExecutionStatus("idle");

            // Simulate execution delay
            const timer = setTimeout(() => {
                setIsExecuting(false);
                setExecutionStatus("success");
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [isActive, code]);

    if (!isActive) return null;

    // Use the code directly - it should include the render() call
    const wrappedCode =
        code ||
        `
const DefaultComponent = () => {
  return (
    <div className="p-8 text-center text-gray-500">
      <div className="text-4xl mb-4">👋</div>
      <div className="text-lg">Write some React code and click Run to see it execute!</div>
    </div>
  );
};

render(DefaultComponent);
`;

    return (
        <div className="h-full flex flex-col">
            {/* Preview Content */}
            <div
                className={`flex-1 p-6 overflow-auto ${
                    isDarkMode ? "bg-gray-900" : "bg-white"
                }`}
            >
                <LiveProvider
                    code={wrappedCode}
                    scope={{
                        React,
                        useState: React.useState,
                        useEffect: React.useEffect,
                    }}
                    noInline={true}
                >
                    <LiveError
                        className={`p-4 mb-4 rounded text-red-800 ${
                            isDarkMode ? "bg-red-900 text-red-200" : "bg-red-50"
                        }`}
                    />
                    <LivePreview className="min-h-[400px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8" />
                </LiveProvider>
            </div>
        </div>
    );
};

export default CodePreview;
