"use client";

import React, { useState, useEffect } from "react";
import { interviewChatStore } from "@/shared/state/interviewChatStore";
import { MAX_PASTE_EVAL_ANSWERS } from "../chat/OpenAITextConversation";
import { SfinxSpinner } from "app/shared/components";

interface CodingEvaluationDebugPanelProps {
    evaluationData: {
        summaryRequest?: any;
        summaryResponse?: any;
        jobSpecificResponse?: any;
        realtimeContributions?: Array<{
            timestamp: string;
            request: {
                currentCode: string;
                diff: string;
                jobCategories: Array<{name: string; description: string}>;
            };
            response: {
                contributionsCount: number;
                contributions: Array<{
                    category: string;
                    strength: number;
                    explanation?: string;
                    caption?: string;
                }>;
            };
        }>;
        timestamp?: number;
        error?: string;
    } | null;
    isLoading?: boolean;
    onTestEvaluation?: () => void;
    nextEvaluationTime?: Date | null;
    jobCategories: Array<{name: string; description: string; weight: number}> | null;
    evaluationThrottleMs: number;
}

export default function CodingEvaluationDebugPanel({ evaluationData, isLoading, onTestEvaluation, nextEvaluationTime, jobCategories, evaluationThrottleMs }: CodingEvaluationDebugPanelProps) {
    // Get job-specific categories from props first, then fall back to evaluation data
    const jobSpecificCategories = evaluationData?.jobSpecificResponse?.data?.categories;
    const categoryNames = jobCategories ? jobCategories.map(c => c.name) : (jobSpecificCategories ? Object.keys(jobSpecificCategories) : []);
    
    const throttleSeconds = Math.round(evaluationThrottleMs / 1000);
    
    // Placeholder message for empty states
    const emptyStateMessage = `Click "Test Evaluation" or start coding (updates every ${throttleSeconds}s of inactivity)`;
    
    type TabType = "summary" | "codeQuality" | "external" | string;
    const [activeTab, setActiveTab] = useState<TabType>("summary");
    
    // Countdown timer for next evaluation
    const [countdown, setCountdown] = useState<number | null>(null);
    
    useEffect(() => {
        if (!nextEvaluationTime) {
            setCountdown(null);
            return;
        }
        
        const interval = setInterval(() => {
            const now = Date.now();
            const timeLeft = nextEvaluationTime.getTime() - now;
            if (timeLeft <= 0) {
                setCountdown(0);
            } else {
                setCountdown(Math.ceil(timeLeft / 1000)); // seconds
            }
        }, 100);
        
        return () => clearInterval(interval);
    }, [nextEvaluationTime]);
    
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
                    <SfinxSpinner size="lg" title="Evaluating" messages="Processing with OpenAI..." />
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

                {evaluationData?.error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Error</div>
                        <div className="text-sm text-red-600 dark:text-red-300">{evaluationData.error}</div>
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab("summary")}
                        className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                            activeTab === "summary"
                                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                    >
                        Summary Evaluation
                    </button>
                    <button
                        onClick={() => setActiveTab("realtime")}
                        className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                            activeTab === "realtime"
                                ? "border-b-2 border-green-500 text-green-600 dark:text-green-400"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                    >
                        Real-Time Contributions
                        {evaluationData?.realtimeContributions && evaluationData.realtimeContributions.length > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-green-600 rounded-full">
                                {evaluationData.realtimeContributions.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("codeQuality")}
                        className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                            activeTab === "codeQuality"
                                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                    >
                        Code Quality
                    </button>
                    <button
                        onClick={() => setActiveTab("external")}
                        className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                            activeTab === "external"
                                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                    >
                        External Tool Evaluation
                    </button>
                    {categoryNames.map((categoryName) => (
                        <button
                            key={categoryName}
                            onClick={() => setActiveTab(categoryName)}
                            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                                activeTab === categoryName
                                    ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                            }`}
                        >
                            {categoryName}
                        </button>
                    ))}
                </div>

                {/* Real-Time Contributions Tab */}
                {activeTab === "realtime" && (
                    <div className="flex flex-col gap-4">
                        {evaluationData?.realtimeContributions && evaluationData.realtimeContributions.length > 0 ? (
                            <>
                                {/* Summary Stats */}
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-700 dark:bg-green-900/20">
                                        <div className="text-xs uppercase tracking-wider text-green-700 dark:text-green-400 mb-1">
                                            Total Evaluations
                                        </div>
                                        <div className="text-2xl font-bold text-green-900 dark:text-green-300">
                                            {evaluationData.realtimeContributions.length}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-700 dark:bg-blue-900/20">
                                        <div className="text-xs uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-1">
                                            Total Contributions
                                        </div>
                                        <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                                            {evaluationData.realtimeContributions.reduce((sum, evaluation) => sum + (evaluation.response?.contributionsCount || 0), 0)}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 dark:border-purple-700 dark:bg-purple-900/20">
                                        <div className="text-xs uppercase tracking-wider text-purple-700 dark:text-purple-400 mb-1">
                                            Categories Hit
                                        </div>
                                        <div className="text-2xl font-bold text-purple-900 dark:text-purple-300">
                                            {new Set(evaluationData.realtimeContributions.flatMap(evaluation => 
                                                evaluation.response?.contributions?.map(c => c.category) || []
                                            )).size}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-700 dark:bg-orange-900/20">
                                        <div className="text-xs uppercase tracking-wider text-orange-700 dark:text-orange-400 mb-1">
                                            Next Evaluation
                                        </div>
                                        <div className="text-2xl font-bold text-orange-900 dark:text-orange-300">
                                            {countdown !== null ? `${countdown}s` : '--'}
                                        </div>
                                    </div>
                                </div>

                                {/* Category Breakdown */}
                                {(() => {
                                    const categoryContributions = new Map<string, Array<{strength: number; explanation: string; timestamp: string}>>();
                                    evaluationData.realtimeContributions.forEach(evaluation => {
                                        evaluation.response?.contributions?.forEach(contrib => {
                                            if (!categoryContributions.has(contrib.category)) {
                                                categoryContributions.set(contrib.category, []);
                                            }
                                            categoryContributions.get(contrib.category)!.push({
                                                strength: contrib.strength,
                                                explanation: contrib.explanation || '',
                                                timestamp: evaluation.timestamp
                                            });
                                        });
                                    });

                                    return (
                                        <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-5 dark:border-purple-700 dark:bg-purple-900/10">
                                            <div className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-4 uppercase tracking-wider">
                                                Category Breakdown
                                            </div>
                                            <div className="space-y-4">
                                                {Array.from(categoryContributions.entries()).map(([category, contribs]) => {
                                                    const avgStrength = Math.round(contribs.reduce((sum, c) => sum + c.strength, 0) / contribs.length);
                                                    return (
                                                        <div key={category} className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                                                            <div className="flex justify-between items-start mb-3">
                                                                <div className="font-medium text-slate-900 dark:text-slate-100">{category}</div>
                                                                <div className="flex items-baseline gap-2">
                                                                    <span className="text-2xl font-bold text-purple-900 dark:text-purple-300">{avgStrength}</span>
                                                                    <span className="text-xs text-slate-500">avg</span>
                                                                </div>
                                                            </div>
                                                            <div className="w-full bg-purple-200 rounded-full h-2 mb-3 dark:bg-purple-800">
                                                                <div
                                                                    className="bg-purple-600 h-2 rounded-full dark:bg-purple-500"
                                                                    style={{ width: `${avgStrength}%` }}
                                                                />
                                                            </div>
                                                            <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                                                                {contribs.length} contribution{contribs.length > 1 ? 's' : ''}
                                                            </div>
                                                            <details className="text-xs">
                                                                <summary className="cursor-pointer text-purple-700 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300">
                                                                    View all contributions
                                                                </summary>
                                                                <div className="mt-2 space-y-2 pl-4">
                                                                    {contribs.map((contrib, idx) => (
                                                                        <div key={idx} className="border-l-2 border-purple-300 pl-3 py-1 dark:border-purple-600">
                                                                            <div className="font-medium text-slate-700 dark:text-slate-300">
                                                                                Strength: {contrib.strength} • {new Date(contrib.timestamp).toLocaleTimeString()}
                                                                            </div>
                                                                            <div className="text-slate-600 dark:text-slate-400 mt-1">
                                                                                {contrib.explanation}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </details>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Individual Evaluations */}
                                <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">
                                        Evaluation Timeline
                                    </div>
                                    <div className="space-y-4">
                                        {evaluationData.realtimeContributions.map((evaluation, idx) => (
                                            <details key={idx} className="border border-slate-200 rounded-lg dark:border-slate-700">
                                                <summary className="px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                            Evaluation #{idx + 1}
                                                        </span>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                                            {new Date(evaluation.timestamp).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                    <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                        {evaluation.response?.contributionsCount || 0} contributions
                                                    </span>
                                                </summary>
                                                <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
                                                    {/* Request Info */}
                                                    <div className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                        <div>
                                                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
                                                                Code Diff Sent
                                                            </div>
                                                            <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded overflow-x-auto max-h-40">
{evaluation.request?.diff || 'No diff available'}
                                                            </pre>
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
                                                                Full Current Code Sent
                                                            </div>
                                                            <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded overflow-x-auto max-h-40">
{evaluation.request?.currentCode || 'No code available'}
                                                            </pre>
                                                        </div>
                                                    </div>

                                                    {/* Response Info - All Evaluations */}
                                                    {evaluation.response?.allEvaluations && evaluation.response.allEvaluations.length > 0 ? (
                                                        <div>
                                                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
                                                                All Category Evaluations (Accepted & Rejected)
                                                            </div>
                                                            <div className="space-y-2">
                                                                {evaluation.response.allEvaluations.map((evalItem: any, cIdx: number) => (
                                                                    <div key={cIdx} className={`rounded p-3 border ${
                                                                        evalItem.accepted 
                                                                            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700' 
                                                                            : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'
                                                                    }`}>
                                                                        <div className="flex justify-between items-start mb-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                                                                    {evalItem.category}
                                                                                </div>
                                                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                                                                    evalItem.accepted
                                                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                                                                                        : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                                                                                }`}>
                                                                                    {evalItem.accepted ? 'ACCEPTED' : 'REJECTED'}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-baseline gap-1">
                                                                                <span className={`text-lg font-bold ${
                                                                                    evalItem.accepted ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                                                                }`}>
                                                                                    {evalItem.strength}
                                                                                </span>
                                                                                <span className="text-xs text-slate-500">/100</span>
                                                                            </div>
                                                                        </div>
                                                                        {evalItem.reasoning && (
                                                                            <div className="text-xs text-slate-700 dark:text-slate-300 mb-2 bg-white dark:bg-slate-800 p-2 rounded">
                                                                                <span className="font-semibold">Reasoning: </span>{evalItem.reasoning}
                                                                            </div>
                                                                        )}
                                                                        {evalItem.accepted && evalItem.caption && (
                                                                            <div className="text-xs text-slate-500 dark:text-slate-500 italic">
                                                                                Caption: {evalItem.caption}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                                                            No evaluations available
                                                        </div>
                                                    )}
                                                </div>
                                            </details>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-12">
                                <div className="text-slate-400 dark:text-slate-500 mb-2">
                                    <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div className="text-base text-slate-600 dark:text-slate-300 font-medium mb-2">
                                    No real-time evaluations yet
                                </div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    {emptyStateMessage}
                                </div>
                            </div>
                        )}
                    </div>
                )}

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
                                    {/* Final Evaluation Summary - At the very top */}
                                    {activePasteEval?.readyToEvaluate && activePasteEval?.evaluationReasoning && (
                                        <div className="rounded-[24px] border border-emerald-200/70 bg-emerald-50/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-emerald-700/50 dark:bg-emerald-900/20">
                                            <div className="text-xs uppercase tracking-[0.3em] text-emerald-700 dark:text-emerald-400 mb-3">
                                                Summary
                                            </div>
                                            {activePasteEval?.accountabilityScore !== undefined && (
                                                <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-300 mb-3">
                                                    Average Score: {activePasteEval?.accountabilityScore}/100
                                                    {activePasteEval?.topics && activePasteEval.topics.length > 0 && (
                                                        <span className="text-sm font-normal text-emerald-700 dark:text-emerald-400 ml-2">
                                                            (from {activePasteEval.topics.length} {activePasteEval.topics.length === 1 ? 'topic' : 'topics'})
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="text-base text-slate-700 dark:text-slate-200 leading-relaxed">
                                                {activePasteEval?.evaluationReasoning}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Topic Coverage Score */}
                                        {(() => {
                                            const score = activePasteEval?.confidence ?? 0;
                                            const isHigh = score >= 80;
                                            const isMedium = score >= 50 && score < 80;
                                            const isLow = score < 50;
                                            
                                            const bgColor = isHigh ? 'bg-emerald-50/70 dark:bg-emerald-900/20' : isMedium ? 'bg-yellow-50/70 dark:bg-yellow-900/20' : 'bg-red-50/70 dark:bg-red-900/20';
                                            const borderColor = isHigh ? 'border-emerald-200/70 dark:border-emerald-700/50' : isMedium ? 'border-yellow-200/70 dark:border-yellow-700/50' : 'border-red-200/70 dark:border-red-700/50';
                                            const textColor = isHigh ? 'text-emerald-900 dark:text-emerald-300' : isMedium ? 'text-yellow-900 dark:text-yellow-300' : 'text-red-900 dark:text-red-300';
                                            const labelColor = isHigh ? 'text-emerald-700 dark:text-emerald-400' : isMedium ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-700 dark:text-red-400';
                                            const barBg = isHigh ? 'bg-emerald-200 dark:bg-emerald-700' : isMedium ? 'bg-yellow-200 dark:bg-yellow-700' : 'bg-red-200 dark:bg-red-700';
                                            const barColor = isHigh ? 'bg-emerald-600 dark:bg-emerald-500' : isMedium ? 'bg-yellow-600 dark:bg-yellow-500' : 'bg-red-600 dark:bg-red-500';
                                            
                                            return (
                                                <div className={`rounded-[24px] border ${borderColor} ${bgColor} px-5 py-4 shadow-sm shadow-slate-900/10`}>
                                                    <div className="flex flex-col gap-3">
                                                        <div className="flex items-baseline gap-3">
                                                            <span className={`text-2xl font-semibold ${textColor}`}>
                                                                {score}%
                                                            </span>
                                                            <span className={`text-sm ${labelColor}`}>
                                                                topic coverage
                                                            </span>
                                                        </div>
                                                        <div className={`w-full ${barBg} rounded-full h-2`}>
                                                            <div
                                                                className={`${barColor} h-2 rounded-full transition-all`}
                                                                style={{ width: `${score}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        
                                        {/* User Answers Count */}
                                        <div className="rounded-[24px] border border-slate-200/70 bg-white/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-slate-700/50 dark:bg-slate-900/60">
                                            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-2">
                                                User Answers
                                            </div>
                                            <div className="text-3xl font-semibold text-slate-900 dark:text-white">
                                                {activePasteEval?.answerCount ?? 0}
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
                                    
                                    {/* Topic Coverage Panel (Phase 2) */}
                                    {activePasteEval?.topics && activePasteEval.topics.length > 0 && (
                                        <div className="rounded-[24px] border border-purple-200/70 bg-purple-50/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-purple-700/50 dark:bg-purple-900/20">
                                            <div className="text-xs uppercase tracking-[0.3em] text-purple-700 dark:text-purple-400 mb-4">
                                                Topic Coverage Analysis
                                            </div>
                                            <div className="space-y-3">
                                                {activePasteEval.topics.map((topic, idx) => (
                                                    <div key={idx}>
                                                        <div className="flex justify-between items-center mb-1">
                                                            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{topic.name}</div>
                                                            <div className="text-lg font-bold text-purple-900 dark:text-purple-300">{topic.percentage}%</div>
                                                        </div>
                                                        <div className="w-full bg-purple-200 rounded-full h-2 dark:bg-purple-800/30">
                                                            <div
                                                                className="bg-purple-600 h-2 rounded-full transition-all dark:bg-purple-500"
                                                                style={{ width: `${topic.percentage}%` }}
                                                            />
                                                        </div>
                                                        {topic.lastUpdatedBy && (
                                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                                ↳ Last updated: Q{topic.lastUpdatedBy}
                                                            </div>
                                                        )}
                                                        {topic.description && (
                                                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">
                                                                {topic.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                <div className="pt-2 border-t border-purple-200 dark:border-purple-700">
                                                    <div className="text-sm font-semibold text-purple-900 dark:text-purple-300">
                                                        Overall Topic Coverage: {activePasteEval.confidence}%
                                                    </div>
                                                    <div className="text-xs text-slate-600 dark:text-slate-400">
                                                        (Average of {activePasteEval.topics.length} topics)
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Per-Question Scores */}
                                    {activePasteEval?.questionScores && activePasteEval.questionScores.length > 0 && (
                                        <div className="rounded-[24px] border border-blue-200/70 bg-blue-50/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-blue-700/50 dark:bg-blue-900/20">
                                            <div className="text-xs uppercase tracking-[0.3em] text-blue-700 dark:text-blue-400 mb-4">
                                                Per-Question Evaluation
                                            </div>
                                            <div className="space-y-3">
                                                {activePasteEval.questionScores.map((qs, idx) => (
                                                    <div key={idx} className="rounded-lg border border-blue-200 bg-white/90 px-4 py-3 dark:border-blue-700/40 dark:bg-slate-800/60">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                                                                Question {idx + 1}
                                                            </div>
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-xl font-bold text-blue-900 dark:text-blue-300">
                                                                    {qs.score}
                                                                </span>
                                                                <span className="text-xs text-blue-600 dark:text-blue-400">/100</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                                                            <span className="font-medium">Q:</span> {qs.question}
                                                        </div>
                                                        <div className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                                                            <span className="font-medium">A:</span> {qs.answer}
                                                        </div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400 italic mb-1">
                                                            {qs.reasoning}
                                                        </div>
                                                        <div className="text-xs font-medium text-slate-700 dark:text-slate-300 inline-block px-2 py-1 rounded bg-slate-100 dark:bg-slate-700/50">
                                                            Level: {qs.understandingLevel}
                                                        </div>
                                                        {/* Phase 2: Show topics addressed */}
                                                        {qs.topicsAddressed && qs.topicsAddressed.length > 0 && (
                                                            <div className="text-xs text-blue-700 dark:text-blue-400 mt-2 pt-2 border-t border-blue-200 dark:border-blue-700/40">
                                                                <div className="font-medium mb-1">Topics Addressed:</div>
                                                                <div className="space-y-1">
                                                                    {qs.topicsAddressed.map((topic, i) => (
                                                                        <div key={i} className="ml-2">
                                                                            ✓ {topic} (score: {qs.score})
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
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
                                    {emptyStateMessage}
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
                                    {emptyStateMessage}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Job-Specific Category Tabs */}
                {categoryNames.map((categoryName) => {
                    const categoryData = jobSpecificCategories?.[categoryName];
                    return activeTab === categoryName ? (
                        <div key={categoryName} className="flex flex-col gap-4">
                            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                                {categoryData ? (
                                    <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
                                        <div className="text-lg font-semibold text-purple-700 dark:text-purple-400 mb-3">
                                            Score
                                        </div>
                                        <div className="text-4xl font-bold text-purple-900 dark:text-purple-300 mb-4">
                                            {categoryData.score}
                                        </div>
                                        <div className="text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                                            {categoryData.text}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-base text-slate-600 dark:text-slate-300 py-8 text-center">
                                        {emptyStateMessage}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null;
                })}
            </div>
        </div>
    );
}
