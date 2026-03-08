"use client";

import React, { useEffect, useMemo, useState } from "react";
import { TIMEBOX_MS, formatCountdown } from "@/shared/services/backgroundSessionGuard";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/shared/state/store";
import { forceTimeExpiry } from "@/shared/state/slices/backgroundSlice";
import RealTimeContributionsView from "./debug/RealTimeContributionsView";
import { transformBackgroundDataToRealtime } from "./debug/transformers/backgroundDataTransformer";
import ScoreProgressDisplay from "./debug/ScoreProgressDisplay";
import { calculateScore } from "app/shared/utils/calculateScore";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEW_UI;

interface BackgroundDebugPanelProps {
    timeboxMs?: number;
    experienceCategories?: Array<{name: string; description: string; weight: number; example?: string}> | null;
    realtimeEvaluations?: Array<{timestamp: string; question: string; answer: string; evaluations: any[]}>;
}

interface ContributionStats {
    categoryName: string;
    count: number;
    avgStrength: number;
    latestContribution: any;
}

export default function BackgroundDebugPanel({ timeboxMs = TIMEBOX_MS, experienceCategories, realtimeEvaluations = [] }: BackgroundDebugPanelProps) {
    const debugEnabled = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";
    const sessionId = useSelector((state: RootState) => state.interview.sessionId);
    const backgroundState = useSelector((state: RootState) => state.background);
    
    // Read contribution stats from Redux (updated by fast-eval) instead of fetching from DB
    const contributionStats = backgroundState.categoryStats || [];

    const stage = useSelector((state: RootState) => state.interview.stage);
    const startedAtMs = backgroundState.startedAtMs;
    const reason = backgroundState.reason;
    const activePasteEval = useSelector((state: RootState) => state.coding.activePasteEvaluation);

    // Fetch scoring configuration from DB
    const [scoringConfig, setScoringConfig] = useState<{
        experienceWeight: number;
        codingWeight: number;
        aiAssistWeight: number;
        backgroundContributionsTarget: number;
        codingContributionsTarget: number;
    } | null>(null);

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
                        backgroundContributionsTarget: data.config.backgroundContributionsTarget,
                        codingContributionsTarget: data.config.codingContributionsTarget,
                    });
                }
            } catch (err) {
                log.error(LOG_CATEGORY, "[BackgroundDebug] Failed to fetch scoring config:", err);
            }
        };
        
        fetchConfig();
    }, [sessionId]);

    // Force a repaint every second so countdown updates live
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => (t + 1) % 1_000_000), 1000);
        return () => clearInterval(id);
    }, []);

    // Calculate real-time scores (must be before any conditional returns)
    const experienceScores = useMemo(() => {
        if (!experienceCategories || !contributionStats) return [];
        return experienceCategories.map(category => {
            const stat = contributionStats.find(s => s.categoryName === category.name);
            return {
                name: category.name,
                score: stat?.avgStrength || 0,
                weight: category.weight
            };
        });
    }, [experienceCategories, contributionStats]);

    const scores = useMemo(() => {
        if (!scoringConfig) return { experienceScore: 0, codingScore: 0, finalScore: 0, normalizedWorkstyle: { aiAssist: null } };
        return calculateScore(
            { experienceScores, categoryScores: [] },
            {},
            scoringConfig
        );
    }, [experienceScores, scoringConfig]);

    const now = Date.now();
    const limitMs: number = Number.isFinite(backgroundState.timeboxMs) && backgroundState.timeboxMs! > 0
        ? backgroundState.timeboxMs!
        : TIMEBOX_MS;
    const remainingMs = startedAtMs ? Math.max(0, startedAtMs + limitMs - now) : limitMs;
    const countdown = formatCountdown(remainingMs);
    const reasonLabel = reason ? reason.replace("_", " ") : "—";

    const dispatch = useDispatch();
    const handleForceTimeExpiry = () => {
        dispatch(forceTimeExpiry());
    };

    const stageName = typeof stage === "string" ? stage : "";

    if (!debugEnabled) {
        return null;
    }
    const prettyStage = stageName
        ? stageName
              .split("_")
              .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(" ")
        : "";
    const panelTitle = stageName === "greeting"
        ? "Greeting Gate"
        : stageName === "background"
        ? "Background Gate"
        : stageName === "coding"
        ? "Coding Stage"
        : prettyStage
        ? `${prettyStage} Stage`
        : "Debug Panel";

    if (!stageName) {
        return (
            <div className="rounded-[28px] border border-slate-200/70 bg-white/80 px-6 py-5 text-sm shadow-lg shadow-slate-900/5 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-100">
                <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                    Interview idle — start to see guard data
                </div>
            </div>
        );
    }

    if (stageName === "greeting") {
        return (
            <div className="rounded-[28px] border border-slate-200/70 bg-white/80 px-6 py-5 text-sm shadow-lg shadow-slate-900/5 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-100">
                <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                    {panelTitle}
                </div>
            </div>
        );
    }

    // Coding stage panel
    if (stageName === "coding") {
        // No active paste evaluation - show simple message
        if (!activePasteEval) {
            return (
                <div className="rounded-[28px] border border-slate-200/70 bg-white/80 px-6 py-5 text-sm shadow-lg shadow-slate-900/5 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-100">
                    <div className="flex flex-col gap-4">
                        <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                            {panelTitle}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                            Workstyle metrics tracking active
                        </div>
                    </div>
                </div>
            );
        }

        // Active paste evaluation - show detailed tracking
        const confidence = (activePasteEval as any).confidence ?? 0;
        const answerCount = activePasteEval.answerCount ?? 0;
        const readyToEvaluate = activePasteEval.readyToEvaluate ?? false;
        const currentQuestion = activePasteEval.currentQuestion;
        const evaluationReasoning = activePasteEval.evaluationReasoning;
        const evaluationCaption = activePasteEval.evaluationCaption;
        
        // Show completed evaluation if reasoning is available
        const showEvaluation = readyToEvaluate && (evaluationReasoning || evaluationCaption);

        return (
            <div className="rounded-[28px] border border-slate-200/70 bg-white/80 px-6 py-5 text-sm shadow-lg shadow-slate-900/5 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-100">
                <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-start justify-between gap-6">
                        <div>
                            <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                                {panelTitle} - External Tool Evaluation
                            </div>
                            <div className="mt-2 flex items-baseline gap-3">
                                <span
                                    className={`text-2xl font-semibold ${
                                        showEvaluation
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-slate-900 dark:text-white"
                                    }`}
                                >
                                    {showEvaluation ? "Complete" : "Evaluating"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {/* Confidence */}
                        <div className="rounded-[24px] border border-slate-200/70 bg-white/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-slate-700/50 dark:bg-slate-900/60">
                            <div className="flex flex-col gap-3">
                                <div className="flex items-baseline gap-3">
                                    <span className="text-xl font-semibold text-slate-900 dark:text-white">
                                        {confidence}%
                                    </span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        confidence
                                    </span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all dark:bg-blue-500"
                                        style={{ width: `${confidence}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Answer Count & Status */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-[24px] border border-slate-200/70 bg-white/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-slate-700/50 dark:bg-slate-900/60">
                                <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-2">
                                    User Answers
                                </div>
                                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                                    {answerCount}/3
                                </div>
                            </div>
                            <div className="rounded-[24px] border border-slate-200/70 bg-white/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-slate-700/50 dark:bg-slate-900/60">
                                <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-2">
                                    Ready to Evaluate
                                </div>
                                <div className={`text-xl font-bold ${
                                    readyToEvaluate ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
                                }`}>
                                    {readyToEvaluate ? "✓ YES" : "○ NO"}
                                </div>
                            </div>
                        </div>

                        {/* Current Question */}
                        {currentQuestion && !showEvaluation && (
                            <div className="rounded-[24px] border border-slate-200/70 bg-white/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-slate-700/50 dark:bg-slate-900/60">
                                <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-2">
                                    Current Question
                                </div>
                                <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                                    {currentQuestion}
                                </div>
                            </div>
                        )}
                        
                        {/* Final Evaluation */}
                        {showEvaluation && (
                            <div className="rounded-[24px] border border-emerald-200/70 bg-emerald-50/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-emerald-700/50 dark:bg-emerald-900/20">
                                <div className="text-[11px] uppercase tracking-[0.3em] text-emerald-700 dark:text-emerald-400 mb-3">
                                    ✓ Evaluation Complete
                                </div>
                                {evaluationCaption && (
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                                        {evaluationCaption}
                                    </div>
                                )}
                                {evaluationReasoning && (
                                    <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                                        {evaluationReasoning}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Background stage panel - now with dynamic categories
    const categoryNames = experienceCategories?.map(c => c.name) || [];
    const evaluatingAnswer = backgroundState.evaluatingAnswer;
    const currentQuestionTarget = backgroundState.currentQuestionTarget;
    const currentFocusTopic = backgroundState.currentFocusTopic;
    const currentQuestionSequence = backgroundState.currentQuestionSequence;
    const clarificationRetryCount = backgroundState.clarificationRetryCount;

    // Get dontKnowCount for current focus topic
    const currentTopicStats = contributionStats.find(s => s.categoryName === currentFocusTopic);
    const currentDontKnowCount = currentTopicStats?.dontKnowCount || 0;
    const dontKnowThreshold = parseInt(process.env.NEXT_PUBLIC_DONT_KNOW_THRESHOLD || '2', 10);

    return (
        <div className="rounded-[28px] border border-slate-200/70 bg-white/80 px-6 py-5 text-sm shadow-lg shadow-slate-900/5 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-100">
            <div className="flex flex-col gap-5">
                {/* Header */}
                <div className="flex items-center justify-between gap-6">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                            {panelTitle}
                        </div>
                        <div className="mt-2 flex items-baseline gap-3">
                            <span className="text-2xl font-semibold text-slate-900 dark:text-white">
                                Collecting
                            </span>
                            {evaluatingAnswer && (
                                <span className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Evaluating...
                                </span>
                            )}
                        </div>
                    </div>
                    
                    {/* Score Stats - centered */}
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center gap-1 px-6 py-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 min-w-[100px]">
                            <span className="text-lg font-semibold text-purple-700 dark:text-purple-400">
                                {Math.round(scores.experienceScore)}%
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-purple-600 dark:text-purple-500">
                                Experience
                            </span>
                        </div>
                        <div className="flex flex-col items-center gap-1 px-6 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 min-w-[100px]">
                            <span className="text-lg font-semibold text-blue-700 dark:text-blue-400">
                                {Math.round(scores.codingScore)}%
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-blue-600 dark:text-blue-500">
                                Coding
                            </span>
                        </div>
                        <div className="flex flex-col items-center gap-1 px-6 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 min-w-[100px]">
                            <span className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                                {Math.round(scores.finalScore)}%
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-500">
                                Final
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/30 min-w-[80px]">
                            <span className="font-mono text-lg font-semibold text-slate-900 dark:text-white">
                                {countdown}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Timer
                            </span>
                        </div>
                        <div className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/30 min-w-[120px]">
                            <span className="font-mono text-lg font-semibold text-slate-900 dark:text-white">
                                Q#{currentQuestionSequence} : {clarificationRetryCount}/3
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Question : Clarify
                            </span>
                        </div>
                        <div className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/30 min-w-[100px]">
                            <span className="font-mono text-lg font-semibold text-slate-900 dark:text-white">
                                {currentFocusTopic ? `${currentFocusTopic.split(' ')[0]}: ${currentDontKnowCount}/${dontKnowThreshold}` : '—'}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Category : Don&apos;t Know
                            </span>
                        </div>
                        <button
                            data-testid="force-complete-background"
                            onClick={handleForceTimeExpiry}
                            className="px-4 py-1.5 text-sm font-medium text-red-600 hover:text-white hover:bg-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white rounded-full transition-all border border-red-200 dark:border-red-800"
                        >
                            End
                        </button>
                    </div>
                </div>
                
                {/* Reason indicator - moved below header */}
                {reason && (
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 dark:text-slate-500">Exit reason:</span>
                        <span className="capitalize text-slate-600 dark:text-slate-300">{reasonLabel}</span>
                    </div>
                )}

                {/* Current Question Target */}
                {currentQuestionTarget && (
                    <div className="rounded-[24px] border border-blue-200/70 bg-blue-50/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-blue-700/50 dark:bg-blue-900/20">
                        <div className="text-[11px] uppercase tracking-[0.3em] text-blue-700 dark:text-blue-400 mb-2">
                            Current Question → Target
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="flex-1">
                                <div className="text-sm text-slate-700 dark:text-slate-200 mb-2">
                                    {currentQuestionTarget.question}
                                </div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/10 dark:bg-blue-400/10 rounded-full">
                                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                                        → {currentFocusTopic}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Real-Time Contributions */}
                <RealTimeContributionsView
                    {...transformBackgroundDataToRealtime(contributionStats, realtimeEvaluations)}
                    contributionsTarget={scoringConfig?.backgroundContributionsTarget}
                />
            </div>
        </div>
    );
}

