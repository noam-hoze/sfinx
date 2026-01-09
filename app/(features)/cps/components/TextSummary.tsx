"use client";

import React from "react";

interface TextSummaryProps {
    executiveSummary: string;
    recommendation?: string;
    experienceCategories: Record<string, {
        score: number;
        text: string;
    }>;
    jobExperienceCategories: Array<{
        name: string;
        description: string;
        weight: number;
    }>;
}

const getScoreColor = (score: number): string => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-blue-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-red-500";
};

const getScoreBadge = (score: number): string => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Improvement";
};

const TextSummary: React.FC<TextSummaryProps> = ({
    executiveSummary,
    recommendation,
    experienceCategories,
    jobExperienceCategories,
}) => {
    const traits = jobExperienceCategories.map(category => ({
        name: category.name,
        key: category.name,
        data: {
            score: experienceCategories[category.name]?.score ?? 0,
            text: experienceCategories[category.name]?.text ?? "",
        }
    }));

    return (
        <div className="space-y-6 p-6">
            {/* Executive Summary Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Executive Summary
                </h2>
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                    {executiveSummary}
                </div>
                {recommendation && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-sm font-semibold text-gray-600 mb-1">
                            Recommendation
                        </p>
                        <p className="text-base font-medium text-gray-900">
                            {recommendation}
                        </p>
                    </div>
                )}
            </div>

            {/* Trait Assessments */}
            {traits.map((trait) => (
                <div
                    key={trait.key}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
                >
                    {/* Trait Header */}
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-900">
                            {trait.name}
                        </h3>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-600">
                                {getScoreBadge(trait.data.score)}
                            </span>
                            <div className="flex items-center gap-2">
                                <div
                                    className={`h-8 w-8 rounded-full ${getScoreColor(
                                        trait.data.score
                                    )} flex items-center justify-center text-white font-bold text-sm`}
                                >
                                    {trait.data.score}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Assessment Text */}
                    <div className="prose prose-sm max-w-none text-gray-700 mb-4 whitespace-pre-wrap">
                        {trait.data.text}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TextSummary;

