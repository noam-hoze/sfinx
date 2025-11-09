"use client";

import React from "react";

interface Evidence {
    question: string;
    answerExcerpt: string;
    reasoning: string;
}

interface TraitSummary {
    score: number;
    text: string;
    evidence?: Evidence[];
}

interface TextSummaryProps {
    executiveSummary: string;
    recommendation?: string;
    adaptability: TraitSummary;
    creativity: TraitSummary;
    reasoning: TraitSummary;
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
    adaptability,
    creativity,
    reasoning,
}) => {
    const traits = [
        { name: "Adaptability", key: "adaptability", data: adaptability },
        { name: "Creativity", key: "creativity", data: creativity },
        { name: "Reasoning", key: "reasoning", data: reasoning },
    ];

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

                    {/* Evidence Section */}
                    {trait.data.evidence && trait.data.evidence.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-gray-200">
                            <h4 className="text-sm font-semibold text-gray-600 mb-3">
                                Supporting Evidence
                            </h4>
                            <div className="space-y-4">
                                {trait.data.evidence.map((ev, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-gray-50 rounded-lg p-4"
                                    >
                                        <p className="text-sm font-medium text-gray-900 mb-2">
                                            <span className="text-gray-500">
                                                Q:
                                            </span>{" "}
                                            {ev.question}
                                        </p>
                                        <p className="text-sm text-gray-700 mb-2 italic border-l-2 border-blue-300 pl-3">
                                            &quot;{ev.answerExcerpt}&quot;
                                        </p>
                                        <p className="text-xs text-gray-600">
                                            <span className="font-medium">
                                                Analysis:
                                            </span>{" "}
                                            {ev.reasoning}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default TextSummary;

