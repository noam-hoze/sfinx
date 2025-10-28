"use client";

import React from "react";
import { interviewChatStore } from "@/shared/state/interviewChatStore";

/**
 * BackgroundDebugBadge displays the current stage and confidence when DEBUG_MODE=true.
 */
const BackgroundDebugBadge: React.FC = () => {
    const [confidence, setConfidence] = React.useState(
        interviewChatStore.getState().background.confidence
    );
    const [transitioned, setTransitioned] = React.useState(
        interviewChatStore.getState().background.transitioned
    );
    const [stage, setStage] = React.useState(
        interviewChatStore.getState().stage
    );

    React.useEffect(() => {
        return interviewChatStore.subscribe(() => {
            const s = interviewChatStore.getState();
            setConfidence(s.background.confidence);
            setTransitioned(s.background.transitioned);
            setStage(s.stage);
        });
    }, []);

    const debugEnabled = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";
    if (!debugEnabled) return null;

    return (
        <div className="fixed bottom-3 right-3 z-50 px-3 py-2 rounded-md bg-black/70 text-white text-xs shadow-lg">
            <div>Stage: {stage} {transitioned && stage === "background" ? "(done)" : ""}</div>
            <div>Confidence: {Math.round(confidence)}%</div>
        </div>
    );
};

export default BackgroundDebugBadge;
