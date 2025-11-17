"use client";

import React, { useState, useEffect, useMemo } from "react";
import { LiveProvider, LiveError, LivePreview } from "react-live";

interface CodePreviewProps {
    code: string;
    isActive: boolean;
    isDarkMode?: boolean;
    onExecutionResult?: (result: {
        status: "success" | "error";
        output: string;
    }) => void;
}

const CodePreview: React.FC<CodePreviewProps> = ({
    code,
    isActive,
    isDarkMode = false,
    onExecutionResult,
}) => {
    const [isExecuting, setIsExecuting] = useState(false);
    const [executionStatus, setExecutionStatus] = useState<
        "idle" | "success" | "error"
    >("idle");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const previewRef = React.useRef<HTMLDivElement>(null);

    // Use the code directly - it should include the render() call
    const wrappedCode = React.useMemo(
        () =>
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
`,
        [code]
    );

    const liveProviderScope = useMemo(
        () => ({
            React,
            useState: React.useState,
            useEffect: React.useEffect,
            useRef: React.useRef,
        }),
        []
    );

    useEffect(() => {
        if (isActive && code) {
            console.log("🎬 [CodePreview] Code execution starting...");
            console.log("[CodePreview] Active:", isActive);
            console.log("[CodePreview] Code length:", code.length);
            console.log("[CodePreview] Code preview:", code.substring(0, 150));
            
            setIsExecuting(true);
            setExecutionStatus("idle");
            setErrorMessage("");

            // Simulate execution delay and capture output
            const timer = setTimeout(() => {
                setIsExecuting(false);
                console.log("[CodePreview] Execution timer completed, capturing output...");
                
                // Try to capture rendered output
                try {
                    const previewElement = previewRef.current;
                    let output = "";
                    
                    if (previewElement) {
                        // Capture text content from preview
                        output = previewElement.innerText || previewElement.textContent || "";
                    }
                    
                    console.log("[CodePreview] Preview element found:", !!previewElement);
                    console.log("[CodePreview] Captured output length:", output.length);
                    console.log("[CodePreview] Captured output:", output);
                    console.log("[CodePreview] Error message state:", errorMessage);
                    
                    // Check if the output contains React error indicators OR if errorMessage state has an error
                    const isError = errorMessage || 
                                   output.includes("Error:") || 
                                   output.includes("ReferenceError") || 
                                   output.includes("TypeError") || 
                                   output.includes("SyntaxError") ||
                                   output.includes("is not defined") ||
                                   output.includes("Cannot read") ||
                                   output.includes("undefined is not");
                    
                    console.log("[CodePreview] isError:", isError);
                    
                    if (isError) {
                        const errorOutput = errorMessage || output;
                        setErrorMessage(errorOutput);
                        setExecutionStatus("error");
                        console.log("❌ [CodePreview] Calling onExecutionResult with ERROR:", {
                            status: "error",
                            outputLength: errorOutput.trim().length,
                            outputPreview: errorOutput.trim().substring(0, 100),
                        });
                        onExecutionResult?.({
                            status: "error",
                            output: errorOutput.trim(),
                        });
                    } else {
                        // If output is empty or default message, try to describe what rendered
                        if (!output || output.includes("Write some React code")) {
                            output = "Component rendered (visual output)";
                        }
                        
                        setExecutionStatus("success");
                        console.log("✅ [CodePreview] Calling onExecutionResult with SUCCESS:", {
                            status: "success",
                            outputLength: output.trim().length,
                            outputPreview: output.trim().substring(0, 100),
                        });
                        onExecutionResult?.({
                            status: "success",
                            output: output.trim(),
                        });
                    }
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : "Unknown error";
                    setErrorMessage(errorMsg);
                    setExecutionStatus("error");
                    onExecutionResult?.({
                        status: "error",
                        output: `Error: ${errorMsg}`,
                    });
                }
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [isActive, code, onExecutionResult]);

    if (!isActive) return null;

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
                    scope={liveProviderScope}
                    noInline={true}
                >
                    <div ref={previewRef}>
                        <LiveError
                            className={`p-4 mb-4 rounded text-red-800 ${
                                isDarkMode ? "bg-red-900 text-red-200" : "bg-red-50"
                            }`}
                        />
                        <LivePreview className="min-h-[400px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8" />
                    </div>
                </LiveProvider>
            </div>
        </div>
    );
};

export default CodePreview;
