import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeSegment {
    category: string;
    description: string;
    suggestion?: string;
    severity?: "minor" | "moderate" | "major";
    codeSegment: string;
    lineStart: number;
    lineEnd: number;
}

interface CodeQualityAnalysis {
    positives: CodeSegment[];
    improvements: CodeSegment[];
    summary: string;
}

interface CodeQualityModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId: string;
    isDemoMode?: boolean;
}

const CodeQualityModal: React.FC<CodeQualityModalProps> = ({
    isOpen,
    onClose,
    sessionId,
    isDemoMode = false,
}) => {
    const [analysis, setAnalysis] = useState<CodeQualityAnalysis | null>(null);
    const [code, setCode] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [highlightedRange, setHighlightedRange] = useState<{ start: number; end: number } | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);

    React.useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            // Small delay to trigger animation
            setTimeout(() => setIsVisible(true), 10);
            
            if (!analysis) {
                fetchAnalysis();
            }
        } else {
            setIsVisible(false);
            // Wait for fade out animation (150ms) before unmounting
            const timer = setTimeout(() => setShouldRender(false), 150);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose]);

    const fetchAnalysis = async () => {
        try {
            setLoading(true);
            setError(null);

            const url = isDemoMode
                ? `/api/interviews/session/${sessionId}/code-quality-analysis?skip-auth=true`
                : `/api/interviews/session/${sessionId}/code-quality-analysis`;

            const response = await fetch(url, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch code quality analysis");
            }

            const data = await response.json();
            setAnalysis(data.analysis);
            setCode(data.finalCode);
        } catch (err: any) {
            setError(err.message || "Failed to load analysis");
        } finally {
            setLoading(false);
        }
    };

    const getSeverityColor = (severity?: string) => {
        switch (severity) {
            case "major":
                return "text-red-600 bg-red-50 border-red-200";
            case "moderate":
                return "text-amber-600 bg-amber-50 border-amber-200";
            case "minor":
                return "text-yellow-600 bg-yellow-50 border-yellow-200";
            default:
                return "text-emerald-600 bg-emerald-50 border-emerald-200";
        }
    };

    const getSeverityIcon = (severity?: string) => {
        if (!severity) {
            return (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
            );
        }
        
        return (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
        );
    };

    // Custom renderer to highlight specific lines
    const lineProps = (lineNumber: number) => {
        const style: React.CSSProperties = {};
        
        if (highlightedRange && lineNumber >= highlightedRange.start && lineNumber <= highlightedRange.end) {
            style.backgroundColor = "rgba(59, 130, 246, 0.15)";
            style.display = "block";
            style.margin = "0 -1rem";
            style.padding = "0 1rem";
        }
        
        return { style };
    };

    if (!shouldRender) return null;

    const modalContent = (
        <div 
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity ${
                isVisible ? "opacity-100 duration-300" : "opacity-0 duration-150"
            }`}
            onClick={onClose}
        >
            <div 
                className={`bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col transform transition-all ${
                    isVisible ? "scale-100 opacity-100 duration-300" : "scale-95 opacity-0 duration-150"
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-semibold text-gray-900">Code Quality Analysis</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        aria-label="Close modal"
                    >
                        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                                <p className="text-gray-600">Analyzing code quality...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <p className="text-gray-900 font-medium mb-2">Error Loading Analysis</p>
                                <p className="text-gray-600">{error}</p>
                            </div>
                        </div>
                    ) : analysis ? (
                        <>
                            {/* Left: Code (2/3) */}
                            <div className="w-2/3 border-r border-gray-200 overflow-auto bg-[#1e1e1e]">
                                <SyntaxHighlighter
                                    language="javascript"
                                    style={vscDarkPlus}
                                    showLineNumbers
                                    wrapLines
                                    lineProps={lineProps}
                                    customStyle={{
                                        margin: 0,
                                        padding: "1.5rem",
                                        background: "#1e1e1e",
                                        fontSize: "0.875rem",
                                    }}
                                >
                                    {code}
                                </SyntaxHighlighter>
                            </div>

                            {/* Right: Analysis (1/3) */}
                            <div className="w-1/3 overflow-auto p-6 bg-gray-50">
                                {/* Summary */}
                                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <h3 className="text-sm font-semibold text-blue-900 mb-2">Overall Assessment</h3>
                                    <p className="text-sm text-blue-800">{analysis.summary}</p>
                                </div>

                                {/* Positives */}
                                <div className="mb-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        What's Good
                                    </h3>
                                    <div className="space-y-2">
                                        {analysis.positives.map((item, index) => (
                                            <div
                                                key={index}
                                                onMouseEnter={() => setHighlightedRange({ start: item.lineStart, end: item.lineEnd })}
                                                onMouseLeave={() => setHighlightedRange(null)}
                                                className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${getSeverityColor()}`}
                                            >
                                                <div className="flex items-start gap-2 mb-1">
                                                    {getSeverityIcon()}
                                                    <span className="text-xs font-semibold uppercase">{item.category}</span>
                                                </div>
                                                <p className="text-sm mb-1">{item.description}</p>
                                                <span className="text-xs opacity-75">Lines {item.lineStart}-{item.lineEnd}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Improvements */}
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        Improvements
                                    </h3>
                                    <div className="space-y-2">
                                        {analysis.improvements.map((item, index) => (
                                            <div
                                                key={index}
                                                onMouseEnter={() => setHighlightedRange({ start: item.lineStart, end: item.lineEnd })}
                                                onMouseLeave={() => setHighlightedRange(null)}
                                                className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${getSeverityColor(item.severity)}`}
                                            >
                                                <div className="flex items-start gap-2 mb-1">
                                                    {getSeverityIcon(item.severity)}
                                                    <span className="text-xs font-semibold uppercase">{item.category}</span>
                                                </div>
                                                <p className="text-sm mb-1 font-medium">{item.description}</p>
                                                {item.suggestion && (
                                                    <p className="text-sm mb-1 italic">💡 {item.suggestion}</p>
                                                )}
                                                <span className="text-xs opacity-75">Lines {item.lineStart}-{item.lineEnd}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );

    // Render modal in a portal at document root to escape parent layout constraints
    return typeof document !== 'undefined' 
        ? createPortal(modalContent, document.body)
        : null;
};

export default CodeQualityModal;

