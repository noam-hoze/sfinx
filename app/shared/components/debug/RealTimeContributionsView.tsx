/**
 * RealTimeContributionsView - Shared presentation component for displaying evaluation data
 * Used by both coding and background debug panels with proper separation of concerns.
 */

"use client";

import React from "react";
import { CONTRIBUTIONS_TARGET } from "shared/constants/interview";

export interface SummaryStats {
    totalEvaluations: number;
    totalContributions: number;
    categoriesHit: number;
    nextEvaluation?: string; // Optional: only coding stage uses this
}

export interface CategoryBreakdownItem {
    name: string;
    avgStrength: number;
    contributionCount: number;
    rawAverage?: number;
    confidence?: number;
    contributions: Array<{
        strength: number;
        explanation: string;
        timestamp: string;
    }>;
}

export interface EvaluationItem {
    timestamp: string;
    contributionsCount: number;
    contextContent: React.ReactNode; // Code diffs OR Question/Answer
    categoryEvaluations: Array<{
        category: string;
        strength: number;
        reasoning: string;
        caption?: string;
    }>;
}

export interface RealTimeContributionsViewProps {
    summaryStats: SummaryStats;
    categoryBreakdown: CategoryBreakdownItem[];
    evaluations: EvaluationItem[];
    emptyStateMessage?: string;
}

export default function RealTimeContributionsView({
    summaryStats,
    categoryBreakdown,
    evaluations,
    emptyStateMessage = "No evaluations yet"
}: RealTimeContributionsViewProps) {
    
    const hasData = evaluations.length > 0 || categoryBreakdown.length > 0;

    if (!hasData) {
        return (
            <div className="text-sm text-slate-600 dark:text-slate-300 py-8 text-center">
                {emptyStateMessage}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-700 dark:bg-green-900/20">
                    <div className="text-xs uppercase tracking-wider text-green-700 dark:text-green-400 mb-1">
                        Total Evaluations
                    </div>
                    <div className="text-2xl font-bold text-green-900 dark:text-green-300">
                        {summaryStats.totalEvaluations}
                    </div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-700 dark:bg-blue-900/20">
                    <div className="text-xs uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-1">
                        Total Contributions
                    </div>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                        {summaryStats.totalContributions}
                    </div>
                </div>
                <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 dark:border-purple-700 dark:bg-purple-900/20">
                    <div className="text-xs uppercase tracking-wider text-purple-700 dark:text-purple-400 mb-1">
                        Categories Hit
                    </div>
                    <div className="text-2xl font-bold text-purple-900 dark:text-purple-300">
                        {summaryStats.categoriesHit}
                    </div>
                </div>
                {summaryStats.nextEvaluation !== undefined && (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-700 dark:bg-orange-900/20">
                        <div className="text-xs uppercase tracking-wider text-orange-700 dark:text-orange-400 mb-1">
                            Next Evaluation
                        </div>
                        <div className="text-2xl font-bold text-orange-900 dark:text-orange-300">
                            {summaryStats.nextEvaluation || '--'}
                        </div>
                    </div>
                )}
            </div>

            {/* Category Breakdown */}
            <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-5 dark:border-purple-700 dark:bg-purple-900/10">
                <div className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-4 uppercase tracking-wider">
                    Category Breakdown
                </div>
                <div className="space-y-4">
                    {categoryBreakdown.map((category) => (
                        <div key={category.name} className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                            <div className="flex justify-between items-start mb-3">
                                <div className="font-medium text-slate-900 dark:text-slate-100">{category.name}</div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-purple-900 dark:text-purple-300">
                                        {category.avgStrength}
                                    </span>
                                    <span className="text-xs text-slate-500">/100</span>
                                </div>
                            </div>
                            {category.confidence !== undefined && category.confidence < 1.0 && (
                                <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded mb-2">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <span>Low confidence ({Math.round(category.confidence * 100)}%)</span>
                                </div>
                            )}
                            {category.rawAverage !== undefined && category.rawAverage !== category.avgStrength && (
                                <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                                    Raw avg: {category.rawAverage} → Adjusted: {category.avgStrength} 
                                    {category.confidence !== undefined && (
                                        <span className="ml-2 text-orange-600 dark:text-orange-400">
                                            (×{category.confidence.toFixed(1)} confidence)
                                        </span>
                                    )}
                                </div>
                            )}
                            <div className="w-full bg-purple-200 rounded-full h-2 mb-3 dark:bg-purple-800">
                                <div
                                    className="bg-purple-600 h-2 rounded-full dark:bg-purple-500"
                                    style={{ width: `${category.avgStrength}%` }}
                                />
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                                {category.contributionCount} / {CONTRIBUTIONS_TARGET} contributions
                                {category.confidence !== undefined && category.confidence >= 1.0 && (
                                    <span className="ml-2 text-green-600 dark:text-green-400">✓ Full confidence</span>
                                )}
                            </div>
                            <details className="text-xs">
                                <summary className="cursor-pointer text-purple-700 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300">
                                    View all contributions
                                </summary>
                                <div className="mt-2 space-y-2 pl-4">
                                    {category.contributions.map((contrib, idx) => (
                                        <div key={idx} className="border-l-2 border-purple-300 pl-3 py-1 dark:border-purple-600">
                                            <div className="font-medium text-slate-700 dark:text-slate-300">
                                                Strength: {contrib.strength} • {new Date(contrib.timestamp).toLocaleTimeString()}
                                            </div>
                                            <div className="text-slate-600 dark:text-slate-400 mt-1">
                                                {contrib.explanation}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </div>
                    ))}
                </div>
            </div>

            {/* Evaluation Timeline */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">
                    Evaluation Timeline
                </div>
                <div className="space-y-4">
                    {evaluations.map((evaluation, idx) => (
                        <details key={idx} className="border border-slate-200 rounded-lg dark:border-slate-700">
                            <summary className="px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Evaluation #{idx + 1}
                                    </span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        {new Date(evaluation.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                                <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    {evaluation.contributionsCount} contribution{evaluation.contributionsCount !== 1 ? 's' : ''}
                                </span>
                            </summary>
                            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
                                {/* Context Content (Code Diff OR Question/Answer) */}
                                <div className="mb-4">
                                    {evaluation.contextContent}
                                </div>

                                {/* Category Evaluations */}
                                {evaluation.categoryEvaluations.length > 0 && (
                                    <div>
                                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
                                            All Category Evaluations
                                        </div>
                                        <div className="space-y-2">
                                            {evaluation.categoryEvaluations.map((evalItem, cIdx) => {
                                                const isStrong = evalItem.strength >= 70;
                                                const isMedium = evalItem.strength >= 40 && evalItem.strength < 70;
                                                const isWeak = evalItem.strength > 0 && evalItem.strength < 40;
                                                const isZero = evalItem.strength === 0;
                                                
                                                const bgColor = isStrong 
                                                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700'
                                                    : isMedium
                                                    ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
                                                    : isWeak
                                                    ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700'
                                                    : 'bg-slate-50 border-slate-200 dark:bg-slate-900/20 dark:border-slate-700';
                                                
                                                const textColor = isStrong
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : isMedium
                                                    ? 'text-blue-600 dark:text-blue-400'
                                                    : isWeak
                                                    ? 'text-yellow-600 dark:text-yellow-400'
                                                    : 'text-slate-600 dark:text-slate-400';
                                                
                                                return (
                                                    <div
                                                        key={cIdx}
                                                        className={`rounded p-3 border ${bgColor}`}
                                                    >
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                                                {evalItem.category}
                                                            </div>
                                                            <div className="flex items-baseline gap-1">
                                                                <span className={`text-lg font-bold ${textColor}`}>
                                                                    {evalItem.strength}
                                                                </span>
                                                                <span className="text-xs text-slate-500">/100</span>
                                                            </div>
                                                        </div>
                                                        {evalItem.reasoning && (
                                                            <div className="text-xs text-slate-700 dark:text-slate-300 mb-2 bg-white dark:bg-slate-800 p-2 rounded">
                                                                <span className="font-semibold">Reasoning: </span>
                                                                {evalItem.reasoning}
                                                            </div>
                                                        )}
                                                        {evalItem.strength > 0 && evalItem.caption && (
                                                            <div className="text-xs text-slate-500 dark:text-slate-500 italic">
                                                                Caption: {evalItem.caption}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </details>
                    ))}
                </div>
            </div>
        </div>
    );
}
