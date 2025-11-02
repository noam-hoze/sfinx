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

    // Latest normalized values (from last CONTROL), not cumulative averages
    const rA = typeof pillars.adaptability === "number" ? Math.max(0, Math.min(1, pillars.adaptability / 100)) : 0;
    const rC = typeof pillars.creativity === "number" ? Math.max(0, Math.min(1, pillars.creativity / 100)) : 0;
    const rR = typeof pillars.reasoning === "number" ? Math.max(0, Math.min(1, pillars.reasoning / 100)) : 0;

    // Force a repaint every second so countdown updates live
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => (t + 1) % 1_000_000), 1000);
        return () => clearInterval(id);
    }, []);

    // Coding panel (blank for now)
    if (stage === "coding") {
        return (
            <div className="mt-3 p-3 rounded border text-sm bg-white/60">
                <div className="font-semibold mb-2">Coding (Debug)</div>
                <div className="text-xs text-gray-600">No data yet.</div>
            </div>
        );
    }

    return (
        <div className="mt-3 p-3 rounded border text-sm bg-white/60">
            <div className="font-semibold mb-2">Background Evaluation (Debug)</div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <div className="text-xs text-gray-600">Confidences (τ={Math.round(tau * 100)}%)</div>
                    <div className="font-mono">
                        {conf ? (
                            <>
                                A:{Math.round(conf.A * 100)}% C:{Math.round(conf.C * 100)}% R:{Math.round(conf.R * 100)}%
                            </>
                        ) : (
                            "A:0% C:0% R:0%"
                        )}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">Gate ready: <span className="font-mono">{ready ? "true" : "false"}</span></div>
                    <div className="text-xs text-gray-600 mt-1">Time left: <span className="font-mono">{formatCountdown(Math.max(0, (startedAtMs ? (startedAtMs + TIMEBOX_MS - Date.now()) : TIMEBOX_MS)))}</span></div>
                    <div className="text-xs text-gray-600 mt-1">zeroRuns:{zeroRuns} projectsUsed:{projectsUsed} {reason ? `(reason: ${reason})` : ""}</div>
                </div>
                <div>
                    <div className="text-xs text-gray-600">Pillars (raw)</div>
                    <div className="font-mono">A:{pillars.adaptability ?? 0} C:{pillars.creativity ?? 0} R:{pillars.reasoning ?? 0}</div>
                </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
                <div>
                    <div className="text-xs font-medium">Adaptability</div>
                    {scorer && (
                        <div className="text-xs text-gray-600 font-mono">n:{scorer.A.n} W:{scorer.A.W.toFixed(2)} r:{rA.toFixed(2)}</div>
                    )}
                    <div className="text-xs whitespace-pre-wrap">{r?.adaptability || ""}</div>
                </div>
                <div>
                    <div className="text-xs font-medium">Creativity</div>
                    {scorer && (
                        <div className="text-xs text-gray-600 font-mono">n:{scorer.C.n} W:{scorer.C.W.toFixed(2)} r:{rC.toFixed(2)}</div>
                    )}
                    <div className="text-xs whitespace-pre-wrap">{r?.creativity || ""}</div>
                </div>
                <div>
                    <div className="text-xs font-medium">Reasoning</div>
                    {scorer && (
                        <div className="text-xs text-gray-600 font-mono">n:{scorer.R.n} W:{scorer.R.W.toFixed(2)} r:{rR.toFixed(2)}</div>
                    )}
                    <div className="text-xs whitespace-pre-wrap">{r?.reasoning || ""}</div>
                </div>
            </div>
        </div>
    );
}


