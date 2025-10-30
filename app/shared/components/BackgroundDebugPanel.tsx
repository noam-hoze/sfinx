"use client";

import React, { useEffect, useState } from "react";
import { interviewChatStore } from "@/shared/state/interviewChatStore";

export default function BackgroundDebugPanel() {
    const [state, setState] = useState(() => interviewChatStore.getState());
    useEffect(() => {
        const unsub = interviewChatStore.subscribe(() => {
            setState(interviewChatStore.getState());
        });
        return () => unsub();
    }, []);

    if (process.env.NEXT_PUBLIC_DEBUG_MODE !== "true") return null;

    const bg = state.background as any;
    const pillars = bg?.pillars || {};
    const r = bg?.rationales || {};

    return (
        <div className="mt-3 p-3 rounded border text-sm bg-white/60">
            <div className="font-semibold mb-2">Background Evaluation (Debug)</div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <div className="text-xs text-gray-600">Overall Confidence</div>
                    <div className="font-mono">{bg?.confidence ?? 0}%</div>
                    {r?.overall && (
                        <div className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">
                            {r.overall}
                        </div>
                    )}
                </div>
                <div>
                    <div className="text-xs text-gray-600">Pillars</div>
                    <div className="font-mono">A:{pillars.adaptability ?? 0} C:{pillars.creativity ?? 0} R:{pillars.reasoning ?? 0}</div>
                </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
                <div>
                    <div className="text-xs font-medium">Adaptability</div>
                    <div className="text-xs whitespace-pre-wrap">{r?.adaptability || ""}</div>
                </div>
                <div>
                    <div className="text-xs font-medium">Creativity</div>
                    <div className="text-xs whitespace-pre-wrap">{r?.creativity || ""}</div>
                </div>
                <div>
                    <div className="text-xs font-medium">Reasoning</div>
                    <div className="text-xs whitespace-pre-wrap">{r?.reasoning || ""}</div>
                </div>
            </div>
        </div>
    );
}


