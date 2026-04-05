/**
 * Scoring calculation utility for candidate evaluation
 */

export interface ScoringConfiguration {
    // Workstyle metric weights
    aiAssistWeight: number;
    /** Problem solving weight — evaluates correctness via code review + output match */
    problemSolvingWeight: number;
    // Category weights
    experienceWeight: number;
    codingWeight: number;
}

export interface RawScores {
    // Experience category scores with weights
    experienceScores: Array<{name: string; score: number; weight: number}>;
    // Coding category scores with weights
    categoryScores: Array<{name: string; score: number; weight: number}>;
}

export interface WorkstyleMetrics {
    aiAssistAccountabilityScore?: number; // Already 0-100
    /** Problem solving score (0-100): average of correctness + output match. Undefined if no expected solution. */
    problemSolvingScore?: number;
}

export interface CalculatedScore {
    finalScore: number; // 0-100
    experienceScore: number; // 0-100 weighted average
    codingScore: number; // 0-100 weighted average including workstyle
    normalizedWorkstyle: {
        aiAssist: number | null; // 0-100
        problemSolving: number | null; // 0-100
    };
}

/**
 * Validates scoring weights before computing candidate scores.
 */
function assertFiniteWeight(name: keyof ScoringConfiguration, value: number): void {
    if (Number.isFinite(value)) {
        return;
    }
    throw new Error(`Invalid scoring configuration: ${name} must be a finite number`);
}

/**
 * Rejects incomplete or inconsistent scoring-weight totals.
 */
function validateScoringConfiguration(config: ScoringConfiguration): void {
    assertFiniteWeight("aiAssistWeight", config.aiAssistWeight);
    assertFiniteWeight("problemSolvingWeight", config.problemSolvingWeight);
    assertFiniteWeight("experienceWeight", config.experienceWeight);
    assertFiniteWeight("codingWeight", config.codingWeight);
    if ((config.aiAssistWeight + config.problemSolvingWeight) > 100.01) {
        throw new Error("Invalid scoring configuration: AI Assist weight and Problem Solving weight cannot exceed 100");
    }
    if (Math.abs((config.experienceWeight + config.codingWeight) - 100) > 0.01) {
        throw new Error("Invalid scoring configuration: Experience weight and coding weight must sum to 100");
    }
}

/**
 * Calculates a weighted average while ignoring zero-weight categories.
 */
function calculateWeightedAverage(scores: Array<{score: number; weight: number}>): number {
    let weightedSum = 0;
    let totalWeight = 0;
    scores.forEach(category => {
        if (category.weight > 0) {
            weightedSum += category.score * category.weight;
            totalWeight += category.weight;
        }
    });
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Calculates the coding score from categories and workstyle metrics.
 */
function calculateCodingScore(
    categoryAverage: number,
    workstyleMetrics: WorkstyleMetrics,
    config: ScoringConfiguration
): number {
    const aiAssistScore = workstyleMetrics.aiAssistAccountabilityScore;
    const problemSolvingScore = workstyleMetrics.problemSolvingScore;
    const categoryContribution = categoryAverage * (100 - config.aiAssistWeight - config.problemSolvingWeight) / 100;
    const aiAssistContribution = aiAssistScore !== undefined && aiAssistScore !== null
        ? aiAssistScore * config.aiAssistWeight / 100
        : 0;
    const problemSolvingContribution = problemSolvingScore !== undefined && problemSolvingScore !== null
        ? problemSolvingScore * config.problemSolvingWeight / 100
        : 0;
    return categoryContribution + aiAssistContribution + problemSolvingContribution;
}

/**
 * Rounds present workstyle metrics and preserves missing values.
 */
function roundMetric(value: number | undefined): number | null {
    return value === undefined || value === null ? null : Math.round(value);
}

/**
 * Calculates the final candidate score from category scores and workstyle metrics.
 */
export function calculateScore(
    rawScores: RawScores,
    workstyleMetrics: WorkstyleMetrics,
    config: ScoringConfiguration
): CalculatedScore {
    validateScoringConfiguration(config);
    const experienceScore = calculateWeightedAverage(rawScores.experienceScores);
    const categoryAverage = calculateWeightedAverage(rawScores.categoryScores);
    const codingScore = calculateCodingScore(categoryAverage, workstyleMetrics, config);
    const finalScore = (
        (experienceScore * config.experienceWeight) +
        (codingScore * config.codingWeight)
    ) / (config.experienceWeight + config.codingWeight);
    return {
        finalScore: Math.round(finalScore),
        experienceScore: Math.round(experienceScore),
        codingScore: Math.round(codingScore),
        normalizedWorkstyle: {
            aiAssist: roundMetric(workstyleMetrics.aiAssistAccountabilityScore),
            problemSolving: roundMetric(workstyleMetrics.problemSolvingScore),
        },
    };
}
