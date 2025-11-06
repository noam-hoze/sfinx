"use client";

import React, { useEffect, useMemo, useState } from "react";
import { interviewChatStore } from "@/shared/state/interviewChatStore";
import { confidences, DefaultConfig, stopCheck } from "@/shared/services/weightedMean/scorer";
import { TIMEBOX_MS, formatCountdown } from "@/shared/services/backgroundSessionGuard";

export default function BackgroundDebugPanel() {
    const [state, setState] = useState(() => interviewChatStore.getState());
    useEffect(() => {
        const unsub = interviewChatStore.subscribe(() => {
            setState(interviewChatStore.getState());
        });
        return () => unsub();
    }, []);

    if (process.env.NEXT_PUBLIC_DEBUG_MODE !== "true") return null;

    const stage = state.stage as any;
    const bg = state.background as any;
    const pillars = bg?.pillars || {};
    const r = bg?.rationales || {};
    const scorer = bg?.scorer;
    const coverage = bg?.coverage;
    const startedAtMs = bg?.startedAtMs;
    const zeroRuns = bg?.zeroRuns ?? 0;
    const projectsUsed = bg?.projectsUsed ?? 0;
    const reason = bg?.reason;

    const conf = useMemo(() => (scorer ? confidences(scorer) : null), [scorer]);
    const tau = DefaultConfig.tau;
    const ready = useMemo(() => (scorer && coverage ? stopCheck(scorer, coverage) : false), [scorer, coverage]);
    const evidenceCounts = scorer
        ? { A: scorer.A.n, C: scorer.C.n, R: scorer.R.n }
        : { A: 0, C: 0, R: 0 };

    // Latest normalized values (from last CONTROL), not cumulative averages
    const rA = typeof pillars.adaptability === "number" ? Math.max(0, Math.min(1, pillars.adaptability / 100)) : 0;
    const rC = typeof pillars.creativity === "number" ? Math.max(0, Math.min(1, pillars.creativity / 100)) : 0;
    const rR = typeof pillars.reasoning === "number" ? Math.max(0, Math.min(1, pillars.reasoning / 100)) : 0;

    // Force a repaint every second so countdown updates live
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => (t + 1) % 1_000_000), 1000);
        return () => clearInterval(id);
    }, []);

    const now = Date.now();
    const remainingMs = startedAtMs ? Math.max(0, startedAtMs + TIMEBOX_MS - now) : TIMEBOX_MS;
    const countdown = formatCountdown(remainingMs);
    const reasonLabel = reason ? reason.replace("_", " ") : "—";

    const traitCards = [
        {
            key: "A" as const,
            label: "Adaptability",
            conf: conf ? conf.A : 0,
            coverage: Boolean(coverage?.A),
            evidence: evidenceCounts.A,
            weight: scorer?.A.W ?? 0,
            latestRaw: pillars.adaptability ?? 0,
            latestNorm: rA,
            rationale: r?.adaptability,
        },
        {
            key: "C" as const,
            label: "Creativity",
            conf: conf ? conf.C : 0,
            coverage: Boolean(coverage?.C),
            evidence: evidenceCounts.C,
            weight: scorer?.C.W ?? 0,
            latestRaw: pillars.creativity ?? 0,
            latestNorm: rC,
            rationale: r?.creativity,
        },
        {
            key: "R" as const,
            label: "Reasoning",
            conf: conf ? conf.R : 0,
            coverage: Boolean(coverage?.R),
            evidence: evidenceCounts.R,
            weight: scorer?.R.W ?? 0,
            latestRaw: pillars.reasoning ?? 0,
            latestNorm: rR,
            rationale: r?.reasoning,
        },
    ];

    const stageName = typeof stage === "string" ? stage : "";
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

    return (
        <div className="rounded-[28px] border border-slate-200/70 bg-white/80 px-6 py-5 text-sm shadow-lg shadow-slate-900/5 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-100">
            <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-6">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                            {panelTitle}
                        </div>
                        <div className="mt-2 flex items-baseline gap-3">
                            <span
                                className={`text-2xl font-semibold ${
                                    ready
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-slate-900 dark:text-white"
                                }`}
                            >
                                {ready ? "Ready" : "Collecting"}
                            </span>
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                τ {Math.round(tau * 100)}%
                            </span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                                Timer
                            </span>
                            <span className="font-mono text-base text-slate-900 dark:text-white">
                                {countdown}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                                Guard
                            </span>
                            <span>
                                Zero Runs <span className="font-mono">{zeroRuns}</span>
                            </span>
                            <span>
                                Projects <span className="font-mono">{projectsUsed}</span>
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                                Reason
                            </span>
                            <span className="capitalize">{reasonLabel}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {traitCards.map((trait) => (
                        <span
                            key={trait.key}
                            className={`rounded-full px-3 py-1 font-medium ${
                                trait.coverage
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                                    : "bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-300"
                            }`}
                        >
                            {trait.label} {trait.coverage ? "covered" : "pending"}
                        </span>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {traitCards.map((trait) => (
                        <div
                            key={trait.key}
                            className="rounded-[24px] border border-slate-200/70 bg-white/70 px-5 py-4 shadow-sm shadow-slate-900/10 dark:border-slate-700/50 dark:bg-slate-900/60"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                                        {trait.label}
                                    </span>
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-xl font-semibold text-slate-900 dark:text-white">
                                            {Math.round(trait.conf * 100)}%
                                        </span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            confidence
                                        </span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
                                    <div>
                                        <span className="uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">
                                            Evidence
                                        </span>
                                        <div className="font-mono text-sm">{trait.evidence}</div>
                                    </div>
                                    <div>
                                        <span className="uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">
                                            Weight
                                        </span>
                                        <div className="font-mono text-sm">{trait.weight.toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <span className="uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">
                                            Latest
                                        </span>
                                        <div className="font-mono text-sm">{Math.round(trait.latestRaw ?? 0)}%</div>
                                    </div>
                                    <div>
                                        <span className="uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-slate-500">
                                            Normalized
                                        </span>
                                        <div className="font-mono text-sm">{trait.latestNorm.toFixed(2)}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 text-xs leading-relaxed text-slate-600 whitespace-pre-wrap dark:text-slate-200">
                                {trait.rationale ? trait.rationale : "Awaiting evidence."}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}


