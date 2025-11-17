import React from "react";
import MetricRow from "./MetricRow";

interface BackgroundSummary {
    executiveSummary?: string;
    executiveSummaryOneLiner?: string | null;
    adaptability?: {
        score: number;
        text: string;
        oneLiner?: string | null;
    };
    creativity?: {
        score: number;
        text: string;
        oneLiner?: string | null;
    };
    reasoning?: {
        score: number;
        text: string;
        oneLiner?: string | null;
    };
}

interface ExperienceMetricsProps {
    backgroundSummary: BackgroundSummary | null;
    onVideoJump: (timestamp: number) => void;
}

const ExperienceMetrics: React.FC<ExperienceMetricsProps> = ({
    backgroundSummary,
    onVideoJump,
}) => {
    if (!backgroundSummary) {
        return (
            <div className="text-sm text-gray-500">
                No experience data available
            </div>
        );
    }

    return (
        <div className="divide-y divide-gray-100">
            <MetricRow
                label="Adaptability"
                description="Ability to adjust to new challenges and changing requirements"
                value={backgroundSummary.adaptability?.score ?? 0}
                benchmarkLow={0}
                benchmarkHigh={100}
            />
            <MetricRow
                label="Creativity"
                description="Capacity for innovative thinking and problem-solving"
                value={backgroundSummary.creativity?.score ?? 0}
                benchmarkLow={0}
                benchmarkHigh={100}
            />
            <MetricRow
                label="Reasoning"
                description="Logical thinking and analytical decision-making skills"
                value={backgroundSummary.reasoning?.score ?? 0}
                benchmarkLow={0}
                benchmarkHigh={100}
            />
        </div>
    );
};

export default ExperienceMetrics;

