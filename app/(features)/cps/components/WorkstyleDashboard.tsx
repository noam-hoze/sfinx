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
    const rawIterationSpeed = workstyle.iterationSpeed?.value;
    const aiAssistValue = (workstyle.aiAssistUsage as any)?.avgAccountabilityScore ?? 100;

    // Use same normalization as calculateScore.ts
    // Iterations to Success normalization (configurable thresholds: 5, 10)
    // Note: value represents "iterations until first CORRECT solution" - lower is better
    const normalizeIterationSpeed = (value: number, moderate = 5, high = 10): number => {
        if (value <= 1) return 100; // Perfect: got it right on first try
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

    const iterationSpeedValue = rawIterationSpeed !== undefined && rawIterationSpeed !== null
        ? Math.round(normalizeIterationSpeed(rawIterationSpeed))
        : null;

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
                label="Iterations to Success"
                description="Attempts needed to reach correct solution (lower is better)"
                value={iterationSpeedValue}
                benchmarkLow={0}
                benchmarkHigh={100}
                evidenceLinks={workstyle.iterationSpeed?.evidenceLinks}
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
