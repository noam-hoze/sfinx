"use client";

import React from "react";

interface CPSDebugPanelProps {
    backgroundSummary: any;
    codingSummary: any;
    workstyle: any;
    scoringConfig: any;
    calculatedScore: number | null;
}

export default function CPSDebugPanel({
    backgroundSummary,
    codingSummary,
    workstyle,
    scoringConfig,
    calculatedScore,
}: CPSDebugPanelProps) {
    const debugEnabled = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";

    if (!debugEnabled) {
        return null;
    }

    // Extract raw scores
    const adaptability = backgroundSummary?.adaptability?.score ?? null;
    const creativity = backgroundSummary?.creativity?.score ?? null;
    const reasoning = backgroundSummary?.reasoning?.score ?? null;
    const codeQuality = codingSummary?.codeQuality?.score ?? null;
    const problemSolving = codingSummary?.problemSolving?.score ?? null;

    // Extract workstyle raw values
    const iterationSpeed = workstyle?.iterationSpeed?.value ?? null;
    const aiAssistAccountability = workstyle?.aiAssistUsage?.avgAccountabilityScore ?? null;

    // Calculate experience and coding averages
    const experienceAvg = adaptability !== null && creativity !== null && reasoning !== null
        ? Math.round((adaptability + creativity + reasoning) / 3)
        : null;
    const codingAvg = codeQuality !== null && problemSolving !== null
        ? Math.round((codeQuality + problemSolving) / 2)
        : null;

    return (
        <div className="rounded-[28px] border border-slate-200/70 bg-white/80 px-6 py-5 text-sm shadow-lg shadow-slate-900/5 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-100">
            <div className="flex flex-col gap-5">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-6">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                            CPS Score Calculation Debug
                        </div>
                        <div className="mt-2 flex items-baseline gap-3">
                            <span className={`text-2xl font-semibold ${
                                calculatedScore !== null && !isNaN(calculatedScore)
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-red-600 dark:text-red-400"
                            }`}>
                                {calculatedScore !== null && !isNaN(calculatedScore) 
                                    ? `${calculatedScore}%` 
                                    : "NaN / Error"}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                final score
                            </span>
                        </div>
                    </div>
                </div>

                {/* Data Availability */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatusCard label="Background Summary" available={!!backgroundSummary} />
                    <StatusCard label="Coding Summary" available={!!codingSummary} />
                    <StatusCard label="Workstyle Metrics" available={!!workstyle} />
                    <StatusCard label="Scoring Config" available={!!scoringConfig} />
                </div>

                {/* Raw Scores */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Experience Scores */}
                    <div className="rounded-[24px] border border-slate-200/70 bg-white/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-slate-700/50 dark:bg-slate-900/60">
                        <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-3">
                            Experience Scores {experienceAvg !== null && `(Avg: ${experienceAvg})`}
                        </div>
                        <div className="space-y-2 text-sm">
                            <ScoreRow label="Adaptability" value={adaptability} />
                            <ScoreRow label="Creativity" value={creativity} />
                            <ScoreRow label="Reasoning" value={reasoning} />
                        </div>
                    </div>

                    {/* Coding Scores */}
                    <div className="rounded-[24px] border border-slate-200/70 bg-white/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-slate-700/50 dark:bg-slate-900/60">
                        <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-3">
                            Coding Scores {codingAvg !== null && `(Avg: ${codingAvg})`}
                        </div>
                        <div className="space-y-2 text-sm">
                            <ScoreRow label="Code Quality" value={codeQuality} />
                            <ScoreRow label="Problem Solving" value={problemSolving} />
                        </div>
                    </div>
                </div>

                {/* Workstyle Metrics */}
                <div className="rounded-[24px] border border-slate-200/70 bg-white/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-slate-700/50 dark:bg-slate-900/60">
                    <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-3">
                        Workstyle Metrics (Raw Values)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        <div>
                            <span className="text-slate-600 dark:text-slate-300">Iteration Speed:</span>
                            <span className="ml-2 font-mono font-semibold text-slate-900 dark:text-white">
                                {iterationSpeed !== null ? iterationSpeed : "N/A"}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-600 dark:text-slate-300">AI Assist Accountability:</span>
                            <span className="ml-2 font-mono font-semibold text-slate-900 dark:text-white">
                                {aiAssistAccountability !== null ? aiAssistAccountability : "N/A"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Scoring Configuration */}
                {scoringConfig && (
                    <div className="rounded-[24px] border border-slate-200/70 bg-white/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-slate-700/50 dark:bg-slate-900/60">
                        <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-3">
                            Scoring Configuration Weights
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                            <div>
                                <div className="font-semibold text-slate-700 dark:text-slate-200 mb-2">Category</div>
                                <div className="space-y-1">
                                    <div>Experience: <span className="font-mono">{scoringConfig.experienceWeight}</span></div>
                                    <div>Coding: <span className="font-mono">{scoringConfig.codingWeight}</span></div>
                                </div>
                            </div>
                            <div>
                                <div className="font-semibold text-slate-700 dark:text-slate-200 mb-2">Experience</div>
                                <div className="space-y-1">
                                    <div>Adaptability: <span className="font-mono">{scoringConfig.adaptabilityWeight}</span></div>
                                    <div>Creativity: <span className="font-mono">{scoringConfig.creativityWeight}</span></div>
                                    <div>Reasoning: <span className="font-mono">{scoringConfig.reasoningWeight}</span></div>
                                </div>
                            </div>
                            <div>
                                <div className="font-semibold text-slate-700 dark:text-slate-200 mb-2">Coding</div>
                                <div className="space-y-1">
                                    <div>Code Quality: <span className="font-mono">{scoringConfig.codeQualityWeight}</span></div>
                                    <div>Problem Solving: <span className="font-mono">{scoringConfig.problemSolvingWeight}</span></div>
                                </div>
                            </div>
                            <div>
                                <div className="font-semibold text-slate-700 dark:text-slate-200 mb-2">Workstyle</div>
                                <div className="space-y-1">
                                    <div>Iteration Speed: <span className="font-mono">{scoringConfig.iterationSpeedWeight}</span></div>
                                    <div>AI Assist: <span className="font-mono">{scoringConfig.aiAssistWeight}</span></div>
                                </div>
                            </div>
                            <div>
                                <div className="font-semibold text-slate-700 dark:text-slate-200 mb-2">Thresholds</div>
                                <div className="space-y-1">
                                    <div>Iter Moderate: <span className="font-mono">{scoringConfig.iterationSpeedThresholdModerate}</span></div>
                                    <div>Iter High: <span className="font-mono">{scoringConfig.iterationSpeedThresholdHigh}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Raw Data Objects */}
                <details className="rounded-[24px] border border-slate-200/70 bg-white/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-slate-700/50 dark:bg-slate-900/60">
                    <summary className="cursor-pointer text-[11px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-3">
                        Raw JSON Data (Click to expand)
                    </summary>
                    <div className="mt-3 space-y-4 text-xs">
                        <div>
                            <div className="font-semibold text-slate-700 dark:text-slate-200 mb-1">backgroundSummary:</div>
                            <pre className="overflow-auto bg-slate-100 dark:bg-slate-800 p-3 rounded">
                                {JSON.stringify(backgroundSummary, null, 2)}
                            </pre>
                        </div>
                        <div>
                            <div className="font-semibold text-slate-700 dark:text-slate-200 mb-1">codingSummary:</div>
                            <pre className="overflow-auto bg-slate-100 dark:bg-slate-800 p-3 rounded">
                                {JSON.stringify(codingSummary, null, 2)}
                            </pre>
                        </div>
                        <div>
                            <div className="font-semibold text-slate-700 dark:text-slate-200 mb-1">workstyle:</div>
                            <pre className="overflow-auto bg-slate-100 dark:bg-slate-800 p-3 rounded">
                                {JSON.stringify(workstyle, null, 2)}
                            </pre>
                        </div>
                        <div>
                            <div className="font-semibold text-slate-700 dark:text-slate-200 mb-1">scoringConfig:</div>
                            <pre className="overflow-auto bg-slate-100 dark:bg-slate-800 p-3 rounded">
                                {JSON.stringify(scoringConfig, null, 2)}
                            </pre>
                        </div>
                    </div>
                </details>
            </div>
        </div>
    );
}

function StatusCard({ label, available }: { label: string; available: boolean }) {
    return (
        <div className={`rounded-lg px-3 py-2 text-center ${
            available 
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
        }`}>
            <div className="text-[10px] uppercase tracking-[0.2em] mb-1">
                {label}
            </div>
            <div className="text-sm font-bold">
                {available ? "✓ Available" : "✗ Missing"}
            </div>
        </div>
    );
}

function ScoreRow({ label, value }: { label: string; value: number | null }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-slate-600 dark:text-slate-300">{label}:</span>
            <span className={`font-mono font-semibold ${
                value !== null 
                    ? "text-slate-900 dark:text-white"
                    : "text-red-600 dark:text-red-400"
            }`}>
                {value !== null ? value : "N/A"}
            </span>
        </div>
    );
}

