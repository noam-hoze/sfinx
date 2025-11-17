"use client";

import React, { useState, useEffect } from "react";
import { interviewChatStore } from "@/shared/state/interviewChatStore";

interface CodingEvaluationDebugPanelProps {
    evaluationData: {
        gapsRequest?: any;
        gapsResponse?: any;
        summaryRequest?: any;
        summaryResponse?: any;
        timestamp?: number;
        error?: string;
    } | null;
    isLoading?: boolean;
    onClose?: () => void;
}

export default function CodingEvaluationDebugPanel({ evaluationData, isLoading, onClose }: CodingEvaluationDebugPanelProps) {
    const [activeTab, setActiveTab] = useState<"summary" | "gaps" | "external">("summary");
    
    // Subscribe to paste evaluation state
    const [chatState, setChatState] = useState(() => interviewChatStore.getState());
    useEffect(() => {
        const unsub = interviewChatStore.subscribe(() => {
            setChatState(interviewChatStore.getState());
        });
        return () => {
            if (unsub) unsub();
        };
    }, []);

    const coding = (chatState as any).coding;
    const activePasteEval = coding?.activePasteEvaluation;

    // Loading state
    if (isLoading) {
        return (
            <div className="w-full h-full rounded-[28px] border border-slate-200/70 bg-white px-6 py-5 text-sm shadow-2xl dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-100 overflow-hidden flex flex-col">
                {onClose && (
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Close"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 dark:border-blue-400"></div>
                    <div className="text-base text-slate-600 dark:text-slate-300">
                        Evaluating with OpenAI...
                    </div>
                </div>
            </div>
        );
    }

    // Empty state
    if (!evaluationData) {
        return (
            <div className="w-full h-full rounded-[28px] border border-slate-200/70 bg-white px-6 py-5 text-sm shadow-2xl dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-100 overflow-hidden flex flex-col">
                {onClose && (
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Close"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
                <div className="flex flex-col gap-4">
                    <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                        Coding Evaluation Debug
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                        Click "Test Evaluation" to see OpenAI evaluation data
                    </div>
                </div>
            </div>
        );
    }

    const timestamp = evaluationData.timestamp ? new Date(evaluationData.timestamp).toLocaleTimeString() : "N/A";

    // Helper to format JSON
    const formatJSON = (obj: any): string => {
        try {
            return JSON.stringify(obj, null, 2);
        } catch {
            return String(obj);
        }
    };

    return (
        <div className="w-full h-full rounded-[28px] border border-slate-200/70 bg-white px-6 py-5 text-sm shadow-2xl dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-100 overflow-hidden flex flex-col relative">
            {/* Close Button */}
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10"
                    aria-label="Close"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
            
            <div className="flex flex-col gap-4 h-full overflow-y-auto">
                <div className="flex items-center justify-between pr-12">
                    <div className="text-sm uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                        Coding Evaluation Debug
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        {timestamp}
                    </div>
                </div>

                {evaluationData.error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Error</div>
                        <div className="text-sm text-red-600 dark:text-red-300">{evaluationData.error}</div>
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab("summary")}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === "summary"
                                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                    >
                        Summary Evaluation
                    </button>
                    <button
                        onClick={() => setActiveTab("gaps")}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === "gaps"
                                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                    >
                        Gaps Analysis
                    </button>
                    <button
                        onClick={() => setActiveTab("external")}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === "external"
                                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                    >
                        External Tool Evaluation
                    </button>
                </div>

                {/* External Tool Tab */}
                {activeTab === "external" && (
                    <div className="flex flex-col gap-4">
                        {!activePasteEval ? (
                            <div className="text-base text-slate-600 dark:text-slate-300">
                                No active paste evaluation. Paste code to trigger external tool tracking.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-5">
                                <div className="flex flex-wrap items-start justify-between gap-6">
                                    <div>
                                        <div className="text-sm uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                                            External Tool Evaluation
                                        </div>
                                        <div className="mt-2 flex items-baseline gap-3">
                                            <span
                                                className={`text-3xl font-semibold ${
                                                    activePasteEval.readyToEvaluate && (activePasteEval.evaluationReasoning || activePasteEval.evaluationCaption)
                                                        ? "text-emerald-600 dark:text-emerald-400"
                                                        : "text-slate-900 dark:text-white"
                                                }`}
                                            >
                                                {activePasteEval.readyToEvaluate && (activePasteEval.evaluationReasoning || activePasteEval.evaluationCaption) ? "Complete" : "Evaluating"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    {/* Confidence */}
                                    <div className="rounded-[24px] border border-slate-200/70 bg-white/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-slate-700/50 dark:bg-slate-900/60">
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-baseline gap-3">
                                                <span className="text-2xl font-semibold text-slate-900 dark:text-white">
                                                    {activePasteEval.confidence ?? 0}%
                                                </span>
                                                <span className="text-sm text-slate-500 dark:text-slate-400">
                                                    confidence
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                                                <div
                                                    className="bg-blue-600 h-2 rounded-full transition-all dark:bg-blue-500"
                                                    style={{ width: `${activePasteEval.confidence ?? 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Answer Count & Status */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="rounded-[24px] border border-slate-200/70 bg-white/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-slate-700/50 dark:bg-slate-900/60">
                                            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-2">
                                                User Answers
                                            </div>
                                            <div className="text-3xl font-semibold text-slate-900 dark:text-white">
                                                {activePasteEval.answerCount ?? 0}/3
                                            </div>
                                        </div>
                                        <div className="rounded-[24px] border border-slate-200/70 bg-white/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-slate-700/50 dark:bg-slate-900/60">
                                            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-2">
                                                Ready to Evaluate
                                            </div>
                                            <div className={`text-2xl font-bold ${
                                                activePasteEval.readyToEvaluate ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
                                            }`}>
                                                {activePasteEval.readyToEvaluate ? "✓ YES" : "○ NO"}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Current Question */}
                                    {activePasteEval.currentQuestion && !(activePasteEval.readyToEvaluate && (activePasteEval.evaluationReasoning || activePasteEval.evaluationCaption)) && (
                                        <div className="rounded-[24px] border border-slate-200/70 bg-white/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-slate-700/50 dark:bg-slate-900/60">
                                            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-2">
                                                Current Question
                                            </div>
                                            <div className="text-base text-slate-700 dark:text-slate-200 leading-relaxed">
                                                {activePasteEval.currentQuestion}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Final Evaluation */}
                                    {activePasteEval.readyToEvaluate && (activePasteEval.evaluationReasoning || activePasteEval.evaluationCaption) && (
                                        <div className="rounded-[24px] border border-emerald-200/70 bg-emerald-50/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-emerald-700/50 dark:bg-emerald-900/20">
                                            <div className="text-xs uppercase tracking-[0.3em] text-emerald-700 dark:text-emerald-400 mb-3">
                                                ✓ Evaluation Complete
                                            </div>
                                            {activePasteEval.evaluationCaption && (
                                                <div className="text-base font-semibold text-slate-900 dark:text-white mb-3">
                                                    {activePasteEval.evaluationCaption}
                                                </div>
                                            )}
                                            {activePasteEval.evaluationReasoning && (
                                                <div className="text-base text-slate-700 dark:text-slate-200 leading-relaxed">
                                                    {activePasteEval.evaluationReasoning}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Summary Tab */}
                {activeTab === "summary" && (
                    <div className="flex flex-col gap-4">
                        {/* Response */}
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Response Received
                                {evaluationData.summaryResponse && (
                                    <span className={`ml-2 text-xs ${
                                        evaluationData.summaryResponse.status === 200
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-red-600 dark:text-red-400"
                                    }`}>
                                        [{evaluationData.summaryResponse.status} {evaluationData.summaryResponse.statusText}]
                                    </span>
                                )}
                            </div>
                            {evaluationData.summaryResponse?.data && (
                                <>
                                    {typeof evaluationData.summaryResponse.data === "object" && evaluationData.summaryResponse.data.summary && (
                                        <div className="space-y-3">
                                            {/* Executive Summary */}
                                            {evaluationData.summaryResponse.data.summary.executiveSummary && (
                                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded">
                                                    <div className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">
                                                        Executive Summary
                                                    </div>
                                                    <div className="text-base text-slate-700 dark:text-slate-300">
                                                        {evaluationData.summaryResponse.data.summary.executiveSummary}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Recommendation */}
                                            {evaluationData.summaryResponse.data.summary.recommendation && (
                                                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded">
                                                    <div className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-2">
                                                        Recommendation
                                                    </div>
                                                    <div className="text-lg font-bold text-purple-900 dark:text-purple-300">
                                                        {evaluationData.summaryResponse.data.summary.recommendation}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Scores */}
                                            <div className="grid grid-cols-2 gap-3">
                                                {evaluationData.summaryResponse.data.summary.codeQuality && (
                                                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded">
                                                        <div className="text-sm font-semibold text-green-700 dark:text-green-400">
                                                            Code Quality
                                                        </div>
                                                        <div className="text-2xl font-bold text-green-900 dark:text-green-300">
                                                            {evaluationData.summaryResponse.data.summary.codeQuality.score}
                                                        </div>
                                                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                                                            {evaluationData.summaryResponse.data.summary.codeQuality.text}
                                                        </div>
                                                    </div>
                                                )}
                                                {evaluationData.summaryResponse.data.summary.problemSolving && (
                                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded">
                                                        <div className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                                                            Problem Solving
                                                        </div>
                                                        <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-300">
                                                            {evaluationData.summaryResponse.data.summary.problemSolving.score}
                                                        </div>
                                                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                                                            {evaluationData.summaryResponse.data.summary.problemSolving.text}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Raw JSON */}
                                            <details className="mt-2">
                                                <summary className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200">
                                                    Show raw JSON
                                                </summary>
                                                <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded overflow-x-auto mt-2 whitespace-pre-wrap break-words">
                                                    {formatJSON(evaluationData.summaryResponse.data)}
                                                </pre>
                                            </details>
                                        </div>
                                    )}
                                    {typeof evaluationData.summaryResponse.data === "string" && (
                                        <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
                                            {evaluationData.summaryResponse.data}
                                        </pre>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Request - collapsed by default */}
                        <details className="border border-slate-200 dark:border-slate-700 rounded-lg">
                            <summary className="text-sm font-semibold text-slate-700 dark:text-slate-300 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                Request Sent (click to expand)
                            </summary>
                            <div className="p-4 pt-0">
                                <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
                                    {formatJSON(evaluationData.summaryRequest)}
                                </pre>
                            </div>
                        </details>
                    </div>
                )}

                {/* Gaps Tab */}
                {activeTab === "gaps" && (
                    <div className="flex flex-col gap-4">
                        {/* Response */}
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Response Received
                                {evaluationData.gapsResponse && (
                                    <span className={`ml-2 text-[10px] ${
                                        evaluationData.gapsResponse.status === 200
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-red-600 dark:text-red-400"
                                    }`}>
                                        [{evaluationData.gapsResponse.status} {evaluationData.gapsResponse.statusText}]
                                    </span>
                                )}
                            </div>
                            {evaluationData.gapsResponse?.data && (
                                <>
                                    {typeof evaluationData.gapsResponse.data === "object" && (evaluationData.gapsResponse.data.gaps || evaluationData.gapsResponse.data.data?.gaps) && (
                                        <div className="space-y-2">
                                            {((evaluationData.gapsResponse.data.gaps || evaluationData.gapsResponse.data.data?.gaps) || []).length === 0 ? (
                                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded text-base text-green-700 dark:text-green-400">
                                                    No gaps identified - strong performance across all metrics
                                                </div>
                                            ) : (
                                                (evaluationData.gapsResponse.data.gaps || evaluationData.gapsResponse.data.data?.gaps || []).map((gap: any, idx: number) => (
                                                    <div
                                                        key={idx}
                                                        className={`p-4 rounded ${
                                                            gap.severity === "major"
                                                                ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                                                                : "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
                                                        }`}
                                                    >
                                                        <div className={`text-sm font-semibold ${
                                                            gap.severity === "major"
                                                                ? "text-red-700 dark:text-red-400"
                                                                : "text-yellow-700 dark:text-yellow-400"
                                                        }`}>
                                                            {gap.title} <span className="text-xs">({gap.severity})</span>
                                                        </div>
                                                        <div className="text-base text-slate-700 dark:text-slate-300 mt-2">
                                                            {gap.description}
                                                        </div>
                                                    </div>
                                                ))
                                            )}

                                            {/* Raw JSON */}
                                            <details className="mt-2">
                                                <summary className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200">
                                                    Show raw JSON
                                                </summary>
                                                <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded overflow-x-auto mt-2 whitespace-pre-wrap break-words">
                                                    {formatJSON(evaluationData.gapsResponse.data)}
                                                </pre>
                                            </details>
                                        </div>
                                    )}
                                    {typeof evaluationData.gapsResponse.data === "string" && (
                                        <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
                                            {evaluationData.gapsResponse.data}
                                        </pre>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Request - collapsed by default */}
                        <details className="border border-slate-200 dark:border-slate-700 rounded-lg">
                            <summary className="text-xs font-semibold text-slate-700 dark:text-slate-300 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                Request Sent (click to expand)
                            </summary>
                            <div className="p-4 pt-0">
                                <pre className="text-[10px] bg-slate-50 dark:bg-slate-800 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
                                    {formatJSON(evaluationData.gapsRequest)}
                                </pre>
                            </div>
                        </details>
                    </div>
                )}
            </div>
        </div>
    );
}
