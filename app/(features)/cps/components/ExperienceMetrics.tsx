import React from "react";
import MetricRow from "./MetricRow";

interface BackgroundSummary {
    executiveSummary?: string;
    executiveSummaryOneLiner?: string | null;
    experienceCategories?: Record<string, {
        score: number;
        text: string;
        description?: string;
        evidenceLinks?: number[];
    }>;
}

interface ExperienceMetricsProps {
    backgroundSummary: BackgroundSummary | null;
    experienceCategories?: Array<{name: string; description: string; weight: number}>;
    onVideoJump: (timestamp: number) => void;
}

const ExperienceMetrics: React.FC<ExperienceMetricsProps> = ({
    backgroundSummary,
    experienceCategories,
    onVideoJump,
}) => {
    if (!backgroundSummary || !backgroundSummary.experienceCategories) {
        return (
            <div className="text-sm text-gray-500">
                No experience categories defined for this job
            </div>
        );
    }

    return (
        <div>
            <div className="divide-y divide-gray-100">
                {experienceCategories
                    ?.filter(categoryDef => categoryDef.weight > 0)
                    .map(categoryDef => {
                        const data = backgroundSummary.experienceCategories?.[categoryDef.name];
                        return (
                            <MetricRow
                                key={categoryDef.name}
                                label={categoryDef.name}
                                description={data?.description || categoryDef.description || ""}
                                value={data?.score ?? 0}
                                benchmarkLow={0}
                                benchmarkHigh={100}
                                evidenceLinks={data?.evidenceLinks || []}
                                onVideoJump={onVideoJump}
                            />
                        );
                    })}
            </div>
        </div>
    );
};

export default ExperienceMetrics;
