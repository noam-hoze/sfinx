import React from "react";
import { WorkstyleMetrics } from "../../../shared/contexts";
import MetricRow from "./MetricRow";

interface WorkstyleDashboardProps {
    workstyle: WorkstyleMetrics;
    onVideoJump: (timestamp: number) => void;
    editMode?: boolean;
    onUpdateWorkstyle?: (workstyle: WorkstyleMetrics) => void;
}

const WorkstyleDashboard: React.FC<WorkstyleDashboardProps> = ({
    workstyle,
    onVideoJump,
    editMode = false,
    onUpdateWorkstyle,
}) => {
    // Extract values
    const iterationSpeedValue = workstyle.iterationSpeed?.value ?? 0;
    const debugLoopsValue = (workstyle.debugLoops as any)?.avgDepth ?? workstyle.debugLoops?.value ?? 0;
    const aiAssistValue = (workstyle.aiAssistUsage as any)?.avgAccountabilityScore ?? 100;

    return (
        <div className="divide-y divide-gray-100">
            <MetricRow
                label="Iteration Speed"
                description="Number of meaningful code iterations completed"
                value={iterationSpeedValue}
                benchmarkLow={0}
                benchmarkHigh={10}
                inverse={true}
            />
            <MetricRow
                label="Debug Loops"
                description="Number of error cycles until successful resolution"
                value={debugLoopsValue}
                benchmarkLow={0}
                benchmarkHigh={5}
                inverse={true}
            />
            <MetricRow
                label="External Tools Usage"
                description="Understanding and accountability for pasted code"
                value={aiAssistValue}
                benchmarkLow={0}
                benchmarkHigh={100}
                inverse={false}
            />
        </div>
    );
};

export default WorkstyleDashboard;
