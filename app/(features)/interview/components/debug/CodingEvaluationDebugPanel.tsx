"use client";

import React, { useState, useEffect } from "react";
import { interviewChatStore } from "@/shared/state/interviewChatStore";

interface CodingEvaluationDebugPanelProps {
    evaluationData: {
        summaryRequest?: any;
        summaryResponse?: any;
        iterations?: any[];
        timestamp?: number;
        error?: string;
    } | null;
    isLoading?: boolean;
    onTestEvaluation?: () => void;
}

export default function CodingEvaluationDebugPanel({ evaluationData, isLoading, onTestEvaluation }: CodingEvaluationDebugPanelProps) {
    const [activeTab, setActiveTab] = useState<"summary" | "codeQuality" | "problemSolving" | "external" | "iterations">("summary");
    
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
            <div className="w-full border border-slate-200 bg-white px-6 py-5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded-lg">
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 dark:border-blue-400"></div>
                    <div className="text-base text-slate-600 dark:text-slate-300">
                        Evaluating with OpenAI...
                    </div>
                </div>
            </div>
        );
    }

    const timestamp = evaluationData?.timestamp ? new Date(evaluationData.timestamp).toLocaleTimeString() : "N/A";

    // Helper to format JSON
    const formatJSON = (obj: any): string => {
        try {
            return JSON.stringify(obj, null, 2);
        } catch {
            return String(obj);
        }
    };

    return (
        <div className="w-full border border-slate-200 bg-white px-6 py-5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded-lg">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="text-sm uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                            Coding Evaluation Debug
                        </div>
                        {onTestEvaluation && (
                            <button
                                onClick={onTestEvaluation}
                                disabled={isLoading}
                                className="px-4 py-2 text-sm font-medium rounded-full transition-all bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Test OpenAI evaluation"
                            >
                                {isLoading ? "Testing..." : "Test Evaluation"}
                            </button>
                        )}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        {timestamp}
                    </div>
                </div>

                {evaluationData?.error && (
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
                        onClick={() => setActiveTab("codeQuality")}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === "codeQuality"
                                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                    >
                        Code Quality
                    </button>
                    <button
                        onClick={() => setActiveTab("problemSolving")}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === "problemSolving"
                                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                    >
                        Problem Solving
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
                    <button
                        onClick={() => setActiveTab("iterations")}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === "iterations"
                                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                    >
                        Iteration Loops
                    </button>
                </div>

                {/* External Tool Tab */}
                {activeTab === "external" && (
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-5">
                                <div className="flex flex-wrap items-start justify-between gap-6">
                                    <div>
                                        <div className="text-sm uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                                            External Tool Evaluation
                                        </div>
                                        <div className="mt-2 flex items-baseline gap-3">
                                            <span
                                                className={`text-3xl font-semibold ${
                                                    activePasteEval?.readyToEvaluate && (activePasteEval?.evaluationReasoning || activePasteEval?.evaluationCaption)
                                                        ? "text-emerald-600 dark:text-emerald-400"
                                                        : "text-slate-900 dark:text-white"
                                                }`}
                                            >
                                                {activePasteEval?.readyToEvaluate && (activePasteEval?.evaluationReasoning || activePasteEval?.evaluationCaption) ? "Complete" : "Evaluating"}
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
                                                    {activePasteEval?.confidence ?? 0}%
                                                </span>
                                                <span className="text-sm text-slate-500 dark:text-slate-400">
                                                    confidence
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                                                <div
                                                    className="bg-blue-600 h-2 rounded-full transition-all dark:bg-blue-500"
                                                    style={{ width: `${activePasteEval?.confidence ?? 0}%` }}
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
                                                {activePasteEval?.answerCount ?? 0}/3
                                            </div>
                                        </div>
                                        <div className="rounded-[24px] border border-slate-200/70 bg-white/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-slate-700/50 dark:bg-slate-900/60">
                                            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-2">
                                                Ready to Evaluate
                                            </div>
                                            <div className={`text-2xl font-bold ${
                                                activePasteEval?.readyToEvaluate ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
                                            }`}>
                                                {activePasteEval?.readyToEvaluate ? "✓ YES" : "○ NO"}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Current Question */}
                                    {activePasteEval?.currentQuestion && !(activePasteEval?.readyToEvaluate && (activePasteEval?.evaluationReasoning || activePasteEval?.evaluationCaption)) && (
                                        <div className="rounded-[24px] border border-slate-200/70 bg-white/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-slate-700/50 dark:bg-slate-900/60">
                                            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-2">
                                                Current Question
                                            </div>
                                            <div className="text-base text-slate-700 dark:text-slate-200 leading-relaxed">
                                                {activePasteEval?.currentQuestion}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Final Evaluation */}
                                    {activePasteEval?.readyToEvaluate && (activePasteEval?.evaluationReasoning || activePasteEval?.evaluationCaption) && (
                                        <div className="rounded-[24px] border border-emerald-200/70 bg-emerald-50/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-emerald-700/50 dark:bg-emerald-900/20">
                                            <div className="text-xs uppercase tracking-[0.3em] text-emerald-700 dark:text-emerald-400 mb-3">
                                                ✓ Evaluation Complete
                                            </div>
                                            {activePasteEval?.evaluationCaption && (
                                                <div className="text-base font-semibold text-slate-900 dark:text-white mb-3">
                                                    {activePasteEval?.evaluationCaption}
                                                </div>
                                            )}
                                            {activePasteEval?.accountabilityScore !== undefined && (
                                                <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-300 mb-3">
                                                    Accountability Score: {activePasteEval?.accountabilityScore}/100
                                                </div>
                                            )}
                                            {activePasteEval?.evaluationReasoning && (
                                                <div className="text-base text-slate-700 dark:text-slate-200 leading-relaxed">
                                                    {activePasteEval?.evaluationReasoning}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                    </div>
                )}

                {/* Summary Tab */}
                {activeTab === "summary" && (
                    <div className="flex flex-col gap-4">
                        {/* Response */}
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Response Received
                                {evaluationData?.summaryResponse && (
                                    <span className={`ml-2 text-xs ${
                                        evaluationData.summaryResponse.status === 200
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-red-600 dark:text-red-400"
                                    }`}>
                                        [{evaluationData.summaryResponse.status} {evaluationData.summaryResponse.statusText}]
                                    </span>
                                )}
                            </div>
                            {evaluationData?.summaryResponse?.data ? (
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
                            ) : (
                                <div className="text-base text-slate-600 dark:text-slate-300 py-8 text-center">
                                    No summary data yet. Click &quot;Test Evaluation&quot; to generate.
                                </div>
                            )}
                        </div>

                        {/* Request - collapsed by default */}
                        {evaluationData?.summaryRequest && (
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
                        )}
                    </div>
                )}

                {/* Code Quality Tab */}
                {activeTab === "codeQuality" && (
                    <div className="flex flex-col gap-4">
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                                Code Quality Evaluation
                            </div>
                            {evaluationData?.summaryResponse?.data?.summary?.codeQuality ? (
                                <div className="space-y-4">
                                    <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
                                        <div className="text-lg font-semibold text-green-700 dark:text-green-400 mb-3">
                                            Score
                                        </div>
                                        <div className="text-4xl font-bold text-green-900 dark:text-green-300 mb-4">
                                            {evaluationData.summaryResponse.data.summary.codeQuality.score}
                                        </div>
                                        <div className="text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                                            {evaluationData.summaryResponse.data.summary.codeQuality.text}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-base text-slate-600 dark:text-slate-300 py-8 text-center">
                                    No code quality data yet. Click &quot;Test Evaluation&quot; to generate.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Problem Solving Tab */}
                {activeTab === "problemSolving" && (
                    <div className="flex flex-col gap-4">
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                                Problem Solving Evaluation
                            </div>
                            {evaluationData?.summaryResponse?.data?.summary?.problemSolving ? (
                                <div className="space-y-4">
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg">
                                        <div className="text-lg font-semibold text-yellow-700 dark:text-yellow-400 mb-3">
                                            Score
                                        </div>
                                        <div className="text-4xl font-bold text-yellow-900 dark:text-yellow-300 mb-4">
                                            {evaluationData.summaryResponse.data.summary.problemSolving.score}
                                        </div>
                                        <div className="text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                                            {evaluationData.summaryResponse.data.summary.problemSolving.text}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-base text-slate-600 dark:text-slate-300 py-8 text-center">
                                    No problem solving data yet. Click &quot;Test Evaluation&quot; to generate.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Iteration Loops Tab */}
                {activeTab === "iterations" && (
                    <div className="flex flex-col gap-4">
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                                Code Iteration History
                            </div>
                            {evaluationData?.iterations && evaluationData.iterations.length > 0 ? (
                                <div className="space-y-4">
                                    {evaluationData.iterations.map((iteration: any, idx: number) => (
                                        <div
                                            key={iteration.id || idx}
                                            className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="text-base font-semibold text-slate-800 dark:text-slate-200">
                                                    Iteration #{(evaluationData.iterations?.length ?? 0) - idx}
                                                </div>
                                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                                    {new Date(iteration.timestamp).toLocaleString()}
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4 mb-3">
                                                <div>
                                                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                                        Evaluation
                                                    </div>
                                                    <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                                                        iteration.evaluation === "correct"
                                                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                                            : iteration.evaluation === "partial"
                                                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                                    }`}>
                                                        {iteration.evaluation}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                                        Match Percentage
                                                    </div>
                                                    <div className="text-base font-semibold text-slate-800 dark:text-slate-200">
                                                        {iteration.matchPercentage}%
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="mb-3">
                                                <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                                    Caption
                                                </div>
                                                <div className="text-base text-slate-700 dark:text-slate-300">
                                                    {iteration.caption}
                                                </div>
                                            </div>
                                            
                                            {iteration.reasoning && (
                                                <details className="mt-2">
                                                    <summary className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200">
                                                        Show reasoning
                                                    </summary>
                                                    <div className="text-base text-slate-700 dark:text-slate-300 mt-2 pl-3 border-l-2 border-slate-300 dark:border-slate-600">
                                                        {iteration.reasoning}
                                                    </div>
                                                </details>
                                            )}
                                            
                                            <details className="mt-2">
                                                <summary className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200">
                                                    Show code snapshot
                                                </summary>
                                                <pre className="text-xs bg-slate-100 dark:bg-slate-900 p-3 rounded overflow-x-auto mt-2 whitespace-pre-wrap break-words">
                                                    {iteration.codeSnapshot}
                                                </pre>
                                            </details>
                                            
                                            <details className="mt-2">
                                                <summary className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200">
                                                    Show actual output
                                                </summary>
                                                <pre className="text-xs bg-slate-100 dark:bg-slate-900 p-3 rounded overflow-x-auto mt-2 whitespace-pre-wrap break-words">
                                                    {iteration.actualOutput}
                                                </pre>
                                            </details>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-base text-slate-600 dark:text-slate-300 py-8 text-center">
                                    No iteration data yet. Run your code to start tracking iterations.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
