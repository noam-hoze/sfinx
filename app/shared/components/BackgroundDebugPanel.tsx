"use client";

import React, { useEffect, useMemo, useState } from "react";
import { interviewChatStore } from "@/shared/state/interviewChatStore";
import { TIMEBOX_MS, formatCountdown } from "@/shared/services/backgroundSessionGuard";
import { useSelector } from "react-redux";
import { RootState } from "@/shared/state/store";
import RealTimeContributionsView from "./debug/RealTimeContributionsView";
import { transformBackgroundDataToRealtime } from "./debug/transformers/backgroundDataTransformer";

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
    const sessionId = useSelector((state: RootState) => state.interviewMachine.sessionId);

    const [state, setState] = useState(() => interviewChatStore.getState());
    const [contributionStats, setContributionStats] = useState<ContributionStats[]>([]);
    
    useEffect(() => {
        if (!debugEnabled) return;
        const unsub = interviewChatStore.subscribe(() => {
            setState(interviewChatStore.getState());
        });
        return () => {
            if (unsub) unsub();
        };
    }, [debugEnabled]);

    // Poll for contributions every 3 seconds
    useEffect(() => {
        if (!debugEnabled || !sessionId) return;
        
        const fetchContributions = async () => {
            try {
                const res = await fetch(`/api/interviews/session/${sessionId}/contributions`);
                if (res.ok) {
                    const data = await res.json();
                    setContributionStats(data.categoryStats || []);
                }
            } catch (err) {
                console.error("[BackgroundDebugPanel] Failed to fetch contributions:", err);
            }
        };

        fetchContributions(); // Initial fetch
        const interval = setInterval(fetchContributions, 3000); // Poll every 3s
        
        return () => clearInterval(interval);
    }, [debugEnabled, sessionId]);

    const stage = state.stage as any;
    const bg = state.background as any;
    const coding = state.coding as any;
    const startedAtMs = bg?.startedAtMs;
    const reason = bg?.reason;
    const activePasteEval = coding?.activePasteEvaluation;

    // Force a repaint every second so countdown updates live
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => (t + 1) % 1_000_000), 1000);
        return () => clearInterval(id);
    }, []);

    const now = Date.now();
    const limitMs = Number.isFinite(timeboxMs) && timeboxMs > 0 ? timeboxMs : TIMEBOX_MS;
    const remainingMs = startedAtMs ? Math.max(0, startedAtMs + limitMs - now) : limitMs;
    const countdown = formatCountdown(remainingMs);
    const reasonLabel = reason ? reason.replace("_", " ") : "—";

    const handleForceTimeExpiry = () => {
        interviewChatStore.dispatch({
            type: "BG_FORCE_TIME_EXPIRY"
        });
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
        const confidence = activePasteEval.confidence ?? 0;
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

    return (
        <div className="rounded-[28px] border border-slate-200/70 bg-white/80 px-6 py-5 text-sm shadow-lg shadow-slate-900/5 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-100">
            <div className="flex flex-col gap-5">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="flex-1">
                        <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                            {panelTitle}
                        </div>
                        <div className="mt-2 flex items-baseline gap-3">
                            <span className="text-2xl font-semibold text-slate-900 dark:text-white">
                                Collecting
                            </span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                                Timer
                            </span>
                            <span className="font-mono text-base text-slate-900 dark:text-white">
                                {countdown}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <button
                                onClick={handleForceTimeExpiry}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors dark:bg-red-700 dark:hover:bg-red-600"
                            >
                                Force Gate
                            </button>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                                Reason
                            </span>
                            <span className="capitalize">{reasonLabel}</span>
                        </div>
                    </div>
                </div>

                {/* Real-Time Contributions */}
                <RealTimeContributionsView
                    {...transformBackgroundDataToRealtime(contributionStats, realtimeEvaluations)}
                />
            </div>
        </div>
    );
}



