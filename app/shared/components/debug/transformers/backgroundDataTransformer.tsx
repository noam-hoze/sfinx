/**
 * Background Data Transformer
 * Transforms background stage data into the format expected by RealTimeContributionsView
 */

import React from "react";
import QuestionAnswerContext from "../contexts/QuestionAnswerContext";
import type { RealTimeContributionsViewProps } from "../RealTimeContributionsView";

interface ContributionStats {
    categoryName: string;
    count: number;
    avgStrength: number;
    rawAverage?: number;
    confidence?: number;
    targetContributions?: number;
}

interface BackgroundEvaluation {
    timestamp: string;
    question: string;
    answer: string;
    evaluations: Array<{
        category: string;
        strength: number;
        reasoning: string;
        caption?: string;
    }>;
}

export function transformBackgroundDataToRealtime(
    contributionStats: ContributionStats[],
    realtimeEvaluations: BackgroundEvaluation[]
): RealTimeContributionsViewProps {
    // Calculate summary stats
    const summaryStats = {
        totalEvaluations: realtimeEvaluations.length,
        totalContributions: contributionStats.reduce((sum, stat) => sum + stat.count, 0),
        categoriesHit: contributionStats.length,
        // No nextEvaluation for background stage
    };

    // Transform category breakdown from API-provided stats
    const categoryBreakdown = contributionStats.map(stat => {
        // Extract contributions for this category from all evaluations
        const contributions: Array<{strength: number; explanation: string; timestamp: string}> = [];
        
        realtimeEvaluations.forEach(evaluation => {
            evaluation.evaluations.forEach(evalItem => {
                if (evalItem.category === stat.categoryName && evalItem.strength > 0) {
                    contributions.push({
                        strength: evalItem.strength,
                        explanation: evalItem.reasoning,
                        timestamp: evaluation.timestamp
                    });
                }
            });
        });

        return {
            name: stat.categoryName,
            avgStrength: Math.round(stat.avgStrength),
            contributionCount: stat.count,
            rawAverage: stat.rawAverage,
            confidence: stat.confidence,
            targetContributions: stat.targetContributions,
            contributions
        };
    });

    // Transform evaluations with Q&A context
    const evaluations = realtimeEvaluations.map(evaluation => ({
        timestamp: evaluation.timestamp,
        contributionsCount: evaluation.evaluations.filter(e => e.strength > 0).length,
        contextContent: (
            <QuestionAnswerContext
                question={evaluation.question}
                answer={evaluation.answer}
            />
        ),
        categoryEvaluations: evaluation.evaluations
    }));

    return {
        summaryStats,
        categoryBreakdown,
        evaluations,
        emptyStateMessage: "No evaluations yet. Answer questions to see real-time evaluations here."
    };
}
