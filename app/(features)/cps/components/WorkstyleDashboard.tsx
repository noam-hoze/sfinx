import React from "react";
import { WorkstyleMetrics } from "../../../shared/contexts";
import MetricRow from "./MetricRow";

interface CodingSummary {
    codeQuality?: {
        score: number;
        text: string;
    };
    problemSolving?: {
        score: number;
        text: string;
    };
}

interface WorkstyleDashboardProps {
    workstyle: WorkstyleMetrics;
    codingSummary?: CodingSummary | null;
    onVideoJump: (timestamp: number) => void;
    editMode?: boolean;
    onUpdateWorkstyle?: (workstyle: WorkstyleMetrics) => void;
}

const WorkstyleDashboard: React.FC<WorkstyleDashboardProps> = ({
    workstyle,
    codingSummary,
    onVideoJump,
    editMode = false,
    onUpdateWorkstyle,
}) => {
    // Extract raw values
    const rawIterationSpeed = workstyle.iterationSpeed?.value ?? 0;
    const rawDebugLoops = (workstyle.debugLoops as any)?.avgDepth ?? workstyle.debugLoops?.value ?? 0;
    const aiAssistValue = (workstyle.aiAssistUsage as any)?.avgAccountabilityScore ?? 100;

    // Use same normalization as calculateScore.ts
    // Iteration Speed normalization (configurable thresholds: 5, 10)
    const normalizeIterationSpeed = (value: number, moderate = 5, high = 10): number => {
        if (value === 0) return 100;
        if (value <= moderate) return 100 - ((value / moderate) * 25);
        if (value <= high) {
            const range = high - moderate;
            const position = (value - moderate) / range;
            return 75 - (position * 25);
        }
        const maxBad = high * 2;
        if (value >= maxBad) return 0;
        const range = maxBad - high;
        const position = (value - high) / range;
        return 50 - (position * 50);
    };

    // Debug Loops normalization (configurable thresholds: 2, 4)
    const normalizeDebugLoops = (avgDepth: number, fast = 2, moderate = 4): number => {
        if (avgDepth === 0) return 100;
        if (avgDepth <= fast) return 100 - ((avgDepth / fast) * 10);
        if (avgDepth <= moderate) {
            const range = moderate - fast;
            const position = (avgDepth - fast) / range;
            return 90 - (position * 20);
        }
        const maxBad = moderate * 2;
        if (avgDepth >= maxBad) return 0;
        const range = maxBad - moderate;
        const position = (avgDepth - moderate) / range;
        return 70 - (position * 70);
    };

    const iterationSpeedValue = Math.round(normalizeIterationSpeed(rawIterationSpeed));
    const debugLoopsValue = Math.round(normalizeDebugLoops(rawDebugLoops));

    return (
        <div className="divide-y divide-gray-100">
            <MetricRow
                label="Problem Solving"
                description="Ability to identify and resolve coding challenges"
                value={codingSummary?.problemSolving?.score ?? 0}
                benchmarkLow={0}
                benchmarkHigh={100}
            />
            <MetricRow
                label="Code Quality"
                description="Adherence to best practices and maintainable code"
                value={codingSummary?.codeQuality?.score ?? 0}
                benchmarkLow={0}
                benchmarkHigh={100}
            />
            <MetricRow
                label="Iteration Speed"
                description="Number of meaningful code iterations completed"
                value={iterationSpeedValue}
                benchmarkLow={0}
                benchmarkHigh={100}
                evidenceLinks={workstyle.iterationSpeed?.evidenceLinks}
                onVideoJump={onVideoJump}
            />
            <MetricRow
                label="Debug Loops"
                description="Number of error cycles until successful resolution"
                value={debugLoopsValue}
                benchmarkLow={0}
                benchmarkHigh={100}
                evidenceLinks={workstyle.debugLoops?.evidenceLinks}
                onVideoJump={onVideoJump}
            />
            <MetricRow
                label="External Tools Usage"
                description="Understanding and accountability for pasted code"
                value={aiAssistValue}
                benchmarkLow={0}
                benchmarkHigh={100}
                inverse={false}
                evidenceLinks={workstyle.aiAssistUsage?.evidenceLinks}
                onVideoJump={onVideoJump}
            />
        </div>
    );
};

export default WorkstyleDashboard;
