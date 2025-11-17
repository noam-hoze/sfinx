import React, { useState } from "react";

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
    const [clickedTimestamp, setClickedTimestamp] = useState<number | null>(null);

    if (!backgroundSummary) {
        return (
            <div className="text-sm text-gray-500">
                No experience data available
            </div>
        );
    }

    const getScoreBadgeClass = (score: number) => {
        if (score >= 75) return "bg-blue-100 text-blue-700";
        if (score >= 50) return "bg-yellow-100 text-yellow-700";
        return "bg-red-100 text-red-700";
    };

    const getScoreLevel = (score: number) => {
        if (score >= 75) return "Strong";
        if (score >= 50) return "Moderate";
        return "Weak";
    };

    const metrics = [
        {
            key: "executiveSummary",
            label: "Executive Summary",
            oneLiner: backgroundSummary.executiveSummaryOneLiner,
            score: null,
        },
        {
            key: "adaptability",
            label: "Adaptability",
            oneLiner: backgroundSummary.adaptability?.oneLiner,
            score: backgroundSummary.adaptability?.score,
        },
        {
            key: "creativity",
            label: "Creativity",
            oneLiner: backgroundSummary.creativity?.oneLiner,
            score: backgroundSummary.creativity?.score,
        },
        {
            key: "reasoning",
            label: "Reasoning",
            oneLiner: backgroundSummary.reasoning?.oneLiner,
            score: backgroundSummary.reasoning?.score,
        },
    ];

    return (
        <div className="space-y-0 divide-y divide-gray-100">
            {metrics.map((metric) => (
                <div
                    key={metric.key}
                    className="py-3 first:pt-0 last:pb-0 px-2 rounded-md hover:bg-gray-50 transition"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                            {metric.label}
                        </span>
                        {metric.score !== null && metric.score !== undefined && (
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-gray-900">
                                    {metric.score}
                                </span>
                                <span
                                    className={`text-xs font-medium px-2 py-1 rounded ${getScoreBadgeClass(
                                        metric.score
                                    )}`}
                                >
                                    {getScoreLevel(metric.score)}
                                </span>
                            </div>
                        )}
                    </div>
                    {metric.oneLiner && (
                        <p className="text-xs text-gray-600 leading-relaxed">
                            {metric.oneLiner}
                        </p>
                    )}
                    {!metric.oneLiner && (
                        <p className="text-xs text-gray-400 italic">
                            No summary available
                        </p>
                    )}
                    {/* Placeholder for future evidence links */}
                    {false && (
                        <div className="flex items-center gap-1 flex-wrap mt-2">
                            <span className="text-xs text-gray-500 mr-1">Evidence:</span>
                            {/* Evidence links will be added here in the future */}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default ExperienceMetrics;

