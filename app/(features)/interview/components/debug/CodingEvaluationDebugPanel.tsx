"use client";

import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEW_UI;

import React, { useState, useEffect, useMemo } from "react";
import { MAX_PASTE_EVAL_ANSWERS } from "../chat/OpenAITextConversation";
import { SfinxSpinner } from "app/shared/components";
import RealTimeContributionsView from "app/shared/components/debug/RealTimeContributionsView";
import { transformCodingDataToRealtime } from "./transformers/codingDataTransformer";
import ScoreProgressDisplay from "app/shared/components/debug/ScoreProgressDisplay";
import { calculateScore } from "app/shared/utils/calculateScore";
import { useSelector } from "react-redux";
import { RootState } from "@/shared/state/store";
import { CONTRIBUTIONS_TARGET } from "@/shared/constants/interview";
import { useInterview } from "app/shared/contexts/interview-context";

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
        iterations?: Array<{
            timestamp: string;
            iterationNumber: number;
            evaluation: string;
            matchPercentage: number;
            reasoning?: string;
            output?: string;
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
    const sessionId = useSelector((state: RootState) => state.interview.sessionId);
    const experienceCategories = useSelector((state: RootState) => state.interview.script?.experienceCategories);
    
    const throttleSeconds = Math.round(evaluationThrottleMs / 1000);
    
    // Placeholder message for empty states
    const emptyStateMessage = `Click "Test Evaluation" or start coding (updates every ${throttleSeconds}s of inactivity)`;
    
    type TabType = "summary" | "codeQuality" | "external" | string;
    const [activeTab, setActiveTab] = useState<TabType>("realtime");
    
    // Countdown timer for next evaluation
    const [countdown, setCountdown] = useState<number | null>(null);
    
    // Fetch background contributions for experience score
    const [contributionStats, setContributionStats] = useState<Array<{categoryName: string; avgStrength: number}>>([]);
    
    // Fetch scoring configuration from DB
    const [scoringConfig, setScoringConfig] = useState<{
        experienceWeight: number;
        codingWeight: number;
        aiAssistWeight: number;
    } | null>(null);

    // Track interview submission state to stop polling
    const { state: interviewState } = useInterview();
    const hasSubmitted = interviewState.hasSubmitted;

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
    
    // Get paste evaluation state from Redux
    const activePasteEval = useSelector((state: RootState) => state.coding.activePasteEvaluation);

    // Fetch background contributions for experience score calculation
    useEffect(() => {
        if (!sessionId) return;

        const fetchBackgroundData = async () => {
            try {
                const res = await fetch(`/api/interviews/session/${sessionId}/contributions`);
                if (res.ok) {
                    const data = await res.json();
                    setContributionStats(data.categoryStats || []);
                }
            } catch (err) {
                log.error(LOG_CATEGORY, "[CodingDebug] Failed to fetch background contributions:", err);
            }
        };

        // Don't fetch if interview is already submitted
        if (hasSubmitted) return;

        fetchBackgroundData();
        const interval = setInterval(fetchBackgroundData, 5000);
        return () => clearInterval(interval);
    }, [sessionId, hasSubmitted]);

    // Fetch scoring configuration
    useEffect(() => {
        if (!sessionId) return;
        
        const fetchConfig = async () => {
            try {
                const res = await fetch(`/api/interviews/session/${sessionId}/scoring-config`);
                if (res.ok) {
                    const data = await res.json();
                    setScoringConfig({
                        experienceWeight: data.config.experienceWeight,
                        codingWeight: data.config.codingWeight,
                        aiAssistWeight: data.config.aiAssistWeight,
                    });
                }
            } catch (err) {
                log.error(LOG_CATEGORY, "[CodingDebug] Failed to fetch scoring config:", err);
            }
        };
        
        fetchConfig();
    }, [sessionId]);

    // Calculate real-time scores
    const experienceScores = useMemo(() => {
        if (!experienceCategories || !contributionStats) return [];
        return experienceCategories.map((category: any) => {
            const stat = contributionStats.find(s => s.categoryName === category.name);
            return {
                name: category.name,
                score: stat?.avgStrength || 0,
                weight: category.weight
            };
        });
    }, [experienceCategories, contributionStats]);

    const codingScores = useMemo(() => {
        if (!jobCategories || !evaluationData?.realtimeContributions || !scoringConfig) return [];
        
        const categoryContributions = new Map<string, number[]>();
        
        evaluationData.realtimeContributions.forEach(contrib => {
            contrib.response?.contributions?.forEach(c => {
                if (!categoryContributions.has(c.category)) {
                    categoryContributions.set(c.category, []);
                }
                categoryContributions.get(c.category)!.push(c.strength);
            });
        });
        
        // Scale category weights to fit within (100 - aiAssistWeight)
        const dbWeightSum = jobCategories.reduce((sum, cat) => sum + (cat.weight || 1), 0);
        const targetCategoryWeight = 100 - scoringConfig.aiAssistWeight;
        const scaleFactor = targetCategoryWeight / dbWeightSum;
        
        return jobCategories.map(category => {
            const strengths = categoryContributions.get(category.name) || [];
            const rawAvg = strengths.length > 0 
                ? strengths.reduce((sum, s) => sum + s, 0) / strengths.length 
                : 0;
            const confidence = Math.min(1.0, strengths.length / CONTRIBUTIONS_TARGET);
            const score = Math.round(rawAvg * confidence);
            
            return {
                name: category.name,
                score,
                weight: category.weight * scaleFactor
            };
        });
    }, [jobCategories, evaluationData?.realtimeContributions, scoringConfig]);

    const scores = useMemo(() => {
        if (!scoringConfig) return { experienceScore: 0, codingScore: 0, finalScore: 0, normalizedWorkstyle: { aiAssist: null } };
        return calculateScore(
            { experienceScores, categoryScores: codingScores },
            { aiAssistAccountabilityScore: activePasteEval?.accountabilityScore },
            scoringConfig
        );
    }, [experienceScores, codingScores, scoringConfig, activePasteEval?.accountabilityScore]);

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

                {/* Score Progress */}
                <ScoreProgressDisplay
                    experienceScore={scores.experienceScore}
                    codingScore={scores.codingScore}
                    finalScore={scores.finalScore}
                    experienceWeight={scoringConfig?.experienceWeight || 50}
                    codingWeight={scoringConfig?.codingWeight || 50}
                />

                {/* Tab Navigation */}
                <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
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
                        onClick={() => setActiveTab("output")}
                        className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                            activeTab === "output"
                                ? "border-b-2 border-orange-500 text-orange-600 dark:text-orange-400"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                    >
                        Output
                        {evaluationData?.iterations && evaluationData.iterations.length > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-orange-600 rounded-full">
                                {evaluationData.iterations.length}
                            </span>
                        )}
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
                        onClick={() => setActiveTab("summary")}
                        className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                            activeTab === "summary"
                                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                    >
                        Summary Evaluation
                    </button>
                </div>

                {/* Real-Time Contributions Tab */}
                {activeTab === "realtime" && (
                    <RealTimeContributionsView
                        {...transformCodingDataToRealtime(
                            evaluationData?.realtimeContributions || [],
                            nextEvaluationTime,
                            evaluationThrottleMs,
                            jobCategories || undefined
                        )}
                    />
                )}

                {/* Output Tab */}
                {activeTab === "output" && (
                    <div className="flex flex-col gap-4">
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                            Output correctness checked on each Run click
                        </div>
                        {evaluationData?.iterations && evaluationData.iterations.length > 0 ? (
                            <div className="space-y-2">
                                {evaluationData.iterations.map((iter: any, idx: number) => {
                                    const timestamp = new Date(iter.timestamp);
                                    const matchColor = (iter.matchPercentage || 0) >= 80 
                                        ? "text-emerald-600 dark:text-emerald-400" 
                                        : (iter.matchPercentage || 0) >= 50 
                                        ? "text-yellow-600 dark:text-yellow-400" 
                                        : "text-red-600 dark:text-red-400";
                                    
                                    return (
                                        <div 
                                            key={idx}
                                            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                                                        Run #{iter.iterationNumber || idx + 1}
                                                    </span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                        {timestamp.toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <div className={`text-lg font-semibold ${matchColor}`}>
                                                    {iter.matchPercentage || 0}%
                                                </div>
                                            </div>
                                            <div className="text-sm text-slate-700 dark:text-slate-300">
                                                Status: <span className="font-medium">{iter.evaluation || "Unknown"}</span>
                                            </div>
                                            {iter.reasoning && (
                                                <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2 rounded">
                                                    {iter.reasoning}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 dark:text-slate-400 italic">
                                No iterations yet. Click Run to check output.
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
                                            const score = activePasteEval?.pasteAccountabilityScore ?? 0;
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
                                                        Overall Topic Coverage: {activePasteEval.pasteAccountabilityScore}%
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
            </div>
        </div>
    );
}
