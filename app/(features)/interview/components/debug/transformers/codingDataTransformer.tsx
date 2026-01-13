/**
 * Coding Data Transformer
 * Transforms coding stage data into the format expected by RealTimeContributionsView
 */

import React from "react";
import CodeDiffContext from "../contexts/CodeDiffContext";
import type { RealTimeContributionsViewProps } from "app/shared/components/debug/RealTimeContributionsView";

interface CodingContribution {
    timestamp: string;
    request: {
        currentCode: string;
        diff: string;
        jobCategories: Array<{name: string; description: string}>;
    };
    response: {
        contributionsCount: number;
        contributions: Array<{
            category: string;
            strength: number;
            explanation?: string;
            caption?: string;
        }>;
        allEvaluations?: Array<{
            category: string;
            strength: number;
            reasoning: string;
            caption?: string;
        }>;
    };
}

export function transformCodingDataToRealtime(
    realtimeContributions: CodingContribution[],
    nextEvaluationTime: Date | null,
    evaluationThrottleMs: number,
    jobCategories?: Array<{name: string; description: string; weight: number}>
): RealTimeContributionsViewProps {
    // Calculate summary stats
    const totalContributions = realtimeContributions.reduce(
        (sum, contrib) => sum + (contrib.response?.contributionsCount || 0),
        0
    );

    const categoriesHit = new Set(
        realtimeContributions.flatMap(contrib =>
            contrib.response?.contributions?.map(c => c.category) || []
        )
    ).size;

    // Calculate countdown for next evaluation
    let nextEvaluationCountdown: string | undefined = undefined;
    if (nextEvaluationTime) {
        const now = Date.now();
        const diff = nextEvaluationTime.getTime() - now;
        if (diff > 0) {
            nextEvaluationCountdown = `${Math.ceil(diff / 1000)}s`;
        } else {
            nextEvaluationCountdown = '0s';
        }
    }

    const summaryStats = {
        totalEvaluations: realtimeContributions.length,
        totalContributions,
        categoriesHit,
        nextEvaluation: nextEvaluationCountdown
    };

    // Compute category breakdown from contributions
    const categoryContributions = new Map<string, Array<{strength: number; explanation: string; timestamp: string}>>();
    
    realtimeContributions.forEach(contrib => {
        contrib.response?.contributions?.forEach(contribution => {
            if (!categoryContributions.has(contribution.category)) {
                categoryContributions.set(contribution.category, []);
            }
            categoryContributions.get(contribution.category)!.push({
                strength: contribution.strength,
                explanation: contribution.explanation || '',
                timestamp: contrib.timestamp
            });
        });
    });

    const TARGET_CONTRIBUTIONS = 5;
    
    // If jobCategories provided, show all categories (even with 0 contributions)
    // Otherwise, only show categories with contributions (backward compatible)
    const categoriesToShow = jobCategories 
        ? jobCategories.map(cat => cat.name)
        : Array.from(categoryContributions.keys());
    
    const categoryBreakdown = categoriesToShow.map(categoryName => {
        const contribs = categoryContributions.get(categoryName) || [];
        const rawAverage = contribs.length > 0 
            ? contribs.reduce((sum, c) => sum + c.strength, 0) / contribs.length 
            : 0;
        const confidence = Math.min(1.0, contribs.length / TARGET_CONTRIBUTIONS);
        const avgStrength = Math.round(rawAverage * confidence);
        
        return {
            name: categoryName,
            avgStrength,
            contributionCount: contribs.length,
            rawAverage: Math.round(rawAverage),
            confidence,
            targetContributions: TARGET_CONTRIBUTIONS,
            contributions: contribs
        };
    });

    // Transform evaluations with code diff context
    const evaluations = realtimeContributions.map(contrib => ({
        timestamp: contrib.timestamp,
        contributionsCount: contrib.response?.contributionsCount || 0,
        contextContent: (
            <CodeDiffContext
                diff={contrib.request?.diff || ''}
                currentCode={contrib.request?.currentCode || ''}
            />
        ),
        categoryEvaluations: contrib.response?.allEvaluations || []
    }));

    const throttleSeconds = Math.round(evaluationThrottleMs / 1000);

    return {
        summaryStats,
        categoryBreakdown,
        evaluations,
        emptyStateMessage: `Click "Test Evaluation" or start coding (updates every ${throttleSeconds}s of inactivity)`
    };
}
