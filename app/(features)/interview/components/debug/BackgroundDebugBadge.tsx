"use client";

import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/shared/state/store";

/**
 * BackgroundDebugBadge displays the current stage when DEBUG_MODE=true.
 */
const BackgroundDebugBadge: React.FC = () => {
    const transitioned = useSelector((state: RootState) => state.background.transitioned);
    const stage = useSelector((state: RootState) => state.interview.stage);

    const debugEnabled = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";
    if (!debugEnabled) return null;

    return (
        <div className="fixed bottom-3 right-3 z-50 px-3 py-2 rounded-md bg-black/70 text-white text-xs shadow-lg">
            <div>Stage: {stage} {transitioned && stage === "background" ? "(done)" : ""}</div>
        </div>
    );
};

export default BackgroundDebugBadge;
