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
    const aiAssistValue = (workstyle.aiAssistUsage as any)?.avgAccountabilityScore ?? 100;

    return (
        <div className="divide-y divide-gray-100">
            <MetricRow
                label="Problem Solving"
                description="Ability to identify and resolve coding challenges"
                value={codingSummary?.problemSolving?.score ?? 0}
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
            <MetricRow
                label="Code Quality"
                description="Adherence to best practices and maintainable code"
                value={codingSummary?.codeQuality?.score ?? 0}
                benchmarkLow={0}
                benchmarkHigh={100}
            />
        </div>
    );
};

export default WorkstyleDashboard;
