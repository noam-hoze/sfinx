"use client";

import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEW_UI;

import React, { useState, useEffect, useMemo } from "react";
import { LiveProvider, LiveError, LivePreview } from "react-live";

interface CodePreviewProps {
    code: string;
    isActive: boolean;
    isDarkMode?: boolean;
    language?: string;
    onExecutionResult?: (result: {
        status: "success" | "error";
        output: string;
    }) => void;
}

const CodePreview: React.FC<CodePreviewProps> = ({
    code,
    isActive,
    isDarkMode = false,
    language = "javascript",
    onExecutionResult,
}) => {
    const [isExecuting, setIsExecuting] = useState(false);
    const [executionStatus, setExecutionStatus] = useState<
        "idle" | "success" | "error"
    >("idle");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [pythonOutput, setPythonOutput] = useState<string>("");
    const [pyodideLoading, setPyodideLoading] = useState(false);
    const previewRef = React.useRef<HTMLDivElement>(null);
    const pyodideRef = React.useRef<any>(null);

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

    // Load Pyodide for Python execution
    useEffect(() => {
        if (language === "python" && !pyodideRef.current && !pyodideLoading) {
            setPyodideLoading(true);
            log.info(LOG_CATEGORY, "[CodePreview] Loading Pyodide...");
            
            const loadPyodide = async () => {
                try {
                    // Load Pyodide from CDN
                    const script = document.createElement("script");
                    script.src = "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js";
                    script.async = true;
                    
                    script.onload = async () => {
                        try {
                            // @ts-ignore
                            const pyodide = await window.loadPyodide({
                                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/",
                            });
                            pyodideRef.current = pyodide;
                            log.info(LOG_CATEGORY, "[CodePreview] ✅ Pyodide loaded successfully");
                            setPyodideLoading(false);
                        } catch (error) {
                            log.error(LOG_CATEGORY, "[CodePreview] ❌ Error initializing Pyodide:", error);
                            setPyodideLoading(false);
                        }
                    };
                    
                    script.onerror = () => {
                        log.error(LOG_CATEGORY, "[CodePreview] ❌ Failed to load Pyodide script");
                        setPyodideLoading(false);
                    };
                    
                    document.head.appendChild(script);
                } catch (error) {
                    log.error(LOG_CATEGORY, "[CodePreview] ❌ Error loading Pyodide:", error);
                    setPyodideLoading(false);
                }
            };
            
            loadPyodide();
        }
    }, [language, pyodideLoading]);

    // Execute Python code
    useEffect(() => {
        if (isActive && code && language === "python" && !pyodideLoading) {
            if (!pyodideRef.current) {
                log.info(LOG_CATEGORY, "[CodePreview] Pyodide not loaded yet, waiting...");
                return;
            }
            
            log.info(LOG_CATEGORY, "🐍 [CodePreview] Executing Python code...");
            setIsExecuting(true);
            setExecutionStatus("idle");
            setErrorMessage("");
            setPythonOutput("");
            
            const executePython = async () => {
                try {
                    const pyodide = pyodideRef.current;
                    
                    // Capture stdout
                    let output = "";
                    pyodide.setStdout({
                        batched: (text: string) => {
                            output += text + "\n";
                        }
                    });
                    
                    // Run the code
                    await pyodide.runPythonAsync(code);
                    
                    // Get the result
                    const finalOutput = output.trim() || "Code executed successfully (no output)";
                    setPythonOutput(finalOutput);
                    setExecutionStatus("success");
                    setIsExecuting(false);
                    
                    log.info(LOG_CATEGORY, "✅ [CodePreview] Python execution success:", finalOutput);
                    onExecutionResult?.({
                        status: "success",
                        output: finalOutput,
                    });
                } catch (error: any) {
                    const errorMsg = error?.message || String(error);
                    setErrorMessage(errorMsg);
                    setExecutionStatus("error");
                    setIsExecuting(false);
                    
                    log.error(LOG_CATEGORY, "❌ [CodePreview] Python execution error:", errorMsg);
                    onExecutionResult?.({
                        status: "error",
                        output: errorMsg,
                    });
                }
            };
            
            executePython();
        }
    }, [isActive, code, language, pyodideLoading, onExecutionResult]);

    // Execute JavaScript code
    useEffect(() => {
        if (language !== "python" && isActive && code) {
            log.info(LOG_CATEGORY, "🎬 [CodePreview] Code execution starting...");
            log.info(LOG_CATEGORY, "[CodePreview] Active:", isActive);
            log.info(LOG_CATEGORY, "[CodePreview] Code length:", code.length);
            log.info(LOG_CATEGORY, "[CodePreview] Code preview:", code.substring(0, 150));
            
            setIsExecuting(true);
            setExecutionStatus("idle");
            setErrorMessage("");

            // Simulate execution delay and capture output
            const timer = setTimeout(() => {
                setIsExecuting(false);
                log.info(LOG_CATEGORY, "[CodePreview] Execution timer completed, capturing output...");
                
                // Try to capture rendered output
                try {
                    const previewElement = previewRef.current;
                    let output = "";
                    
                    if (previewElement) {
                        // Capture text content from preview
                        output = previewElement.innerText || previewElement.textContent || "";
                    }
                    
                    log.info(LOG_CATEGORY, "[CodePreview] Preview element found:", !!previewElement);
                    log.info(LOG_CATEGORY, "[CodePreview] Captured output length:", output.length);
                    log.info(LOG_CATEGORY, "[CodePreview] Captured output:", output);
                    log.info(LOG_CATEGORY, "[CodePreview] Error message state:", errorMessage);
                    
                    // Check if the output contains React error indicators OR if errorMessage state has an error
                    const isError = errorMessage || 
                                   output.includes("Error:") || 
                                   output.includes("ReferenceError") || 
                                   output.includes("TypeError") || 
                                   output.includes("SyntaxError") ||
                                   output.includes("is not defined") ||
                                   output.includes("Cannot read") ||
                                   output.includes("undefined is not");
                    
                    log.info(LOG_CATEGORY, "[CodePreview] isError:", isError);
                    
                    if (isError) {
                        const errorOutput = errorMessage || output;
                        setErrorMessage(errorOutput);
                        setExecutionStatus("error");
                        log.info(LOG_CATEGORY, "❌ [CodePreview] Calling onExecutionResult with ERROR:", {
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
                        log.info(LOG_CATEGORY, "✅ [CodePreview] Calling onExecutionResult with SUCCESS:", {
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
    }, [isActive, code, errorMessage, onExecutionResult]);

    if (!isActive) return null;

    // Python preview
    if (language === "python") {
        return (
            <div className="h-full flex flex-col">
                <div
                    className={`flex-1 p-6 overflow-auto ${
                        isDarkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"
                    }`}
                >
                    {pyodideLoading && (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <div className="text-2xl mb-2">🐍</div>
                                <div>Loading Python environment...</div>
                            </div>
                        </div>
                    )}
                    
                    {!pyodideLoading && isExecuting && (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <div className="text-2xl mb-2">⚙️</div>
                                <div>Executing Python code...</div>
                            </div>
                        </div>
                    )}
                    
                    {!pyodideLoading && !isExecuting && executionStatus === "error" && (
                        <div className={`p-4 rounded ${isDarkMode ? "bg-red-900 text-red-200" : "bg-red-50 text-red-800"}`}>
                            <div className="font-bold mb-2">Error:</div>
                            <pre className="whitespace-pre-wrap font-mono text-sm">{errorMessage}</pre>
                        </div>
                    )}
                    
                    {!pyodideLoading && !isExecuting && executionStatus === "success" && pythonOutput && (
                        <div>
                            <div className={`text-sm font-semibold mb-2 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                                Output:
                            </div>
                            <pre className={`whitespace-pre-wrap font-mono text-sm p-4 rounded ${
                                isDarkMode ? "bg-gray-800" : "bg-gray-100"
                            }`}>{pythonOutput}</pre>
                        </div>
                    )}
                    
                    {!pyodideLoading && !isExecuting && !pythonOutput && !errorMessage && (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center text-gray-500">
                                <div className="text-4xl mb-4">🐍</div>
                                <div className="text-lg">Click Run to execute your Python code</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // JavaScript/React preview
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
