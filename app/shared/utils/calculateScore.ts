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

export interface RawScoreEntry {
    name: string;
    score: number;
    weight: number;
}

export interface RawScores {
    // Experience category scores with weights
    experienceScores: Array<RawScoreEntry>;
    // Coding category scores with weights
    categoryScores: Array<RawScoreEntry>;
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

const DEFAULT_SCORING_CONFIGURATION: ScoringConfiguration = {
    aiAssistWeight: 25,
    problemSolvingWeight: 25,
    experienceWeight: 50,
    codingWeight: 50,
};

/**
 * Resolves persisted scoring config to live scoring defaults.
 */
export function resolveScoringConfiguration(
    config: Partial<ScoringConfiguration> | null | undefined
): ScoringConfiguration {
    if (!config) {
        return { ...DEFAULT_SCORING_CONFIGURATION };
    }

    return {
        aiAssistWeight: config.aiAssistWeight ?? DEFAULT_SCORING_CONFIGURATION.aiAssistWeight,
        problemSolvingWeight: config.problemSolvingWeight ?? 0,
        experienceWeight: config.experienceWeight ?? DEFAULT_SCORING_CONFIGURATION.experienceWeight,
        codingWeight: config.codingWeight ?? DEFAULT_SCORING_CONFIGURATION.codingWeight,
    };
}

/**
 * Builds a score entry while preserving explicit zero weights.
 */
export function createRawScoreEntry(
    name: string,
    score: number | null | undefined,
    weight: number | null | undefined
): RawScoreEntry {
    return { name, score: score ?? 0, weight: weight ?? 1 };
}

/**
 * Clamp score values to a 0-100 range.
 */
function clampScore(value: number): number {
    return Math.max(0, Math.min(100, value));
}

/**
 * Calculate final candidate score based on configuration
 */
export function calculateScore(
    rawScores: RawScores,
    workstyleMetrics: WorkstyleMetrics,
    config: ScoringConfiguration
): CalculatedScore {
    const hasAiAssistScore = workstyleMetrics.aiAssistAccountabilityScore !== undefined &&
                              workstyleMetrics.aiAssistAccountabilityScore !== null;
    const normalizedAiAssist = workstyleMetrics.aiAssistAccountabilityScore;

    const hasProblemSolvingScore = workstyleMetrics.problemSolvingScore !== undefined &&
                                    workstyleMetrics.problemSolvingScore !== null;

    // Calculate experience score from dynamic categories (same pattern as coding)
    let experienceWeightedSum = 0;
    let totalExperienceWeight = 0;

    rawScores.experienceScores.forEach(category => {
        if (category.weight > 0) {
            experienceWeightedSum += category.score * category.weight;
            totalExperienceWeight += category.weight;
        }
    });

    const experienceScore = totalExperienceWeight > 0 ? experienceWeightedSum / totalExperienceWeight : 0;

    // Calculate coding score from category scores with their individual weights
    // Step 1: Calculate weighted average of categories (user enters weights thinking of them as 100%)
    let categoryWeightedSum = 0;
    let totalCategoryWeight = 0;

    rawScores.categoryScores.forEach(category => {
        if (category.weight > 0) {
            categoryWeightedSum += category.score * category.weight;
            totalCategoryWeight += category.weight;
        }
    });

    const categoryAverage = totalCategoryWeight > 0 ? categoryWeightedSum / totalCategoryWeight : 0;

    // Step 2: Categories contribute remaining coding budget after workstyle weights.
    const categoryWeightBudget = clampScore(100 - config.aiAssistWeight - config.problemSolvingWeight);
    const categoryContribution = categoryAverage * categoryWeightBudget / 100;

    // Step 3: AI assist contributes its percentage of the coding score
    const aiAssistContribution = hasAiAssistScore
        ? normalizedAiAssist! * config.aiAssistWeight / 100
        : 0;

    // Step 4: Problem solving contributes its percentage of the coding score
    const problemSolvingContribution = hasProblemSolvingScore
        ? workstyleMetrics.problemSolvingScore! * config.problemSolvingWeight / 100
        : 0;

    // Step 5: Final coding score (0-100)
    const codingScore = clampScore(categoryContribution + aiAssistContribution + problemSolvingContribution);

    // Calculate final score (weighted average of experience and coding)
    const totalMainCategoryWeight = config.experienceWeight + config.codingWeight;
    const finalScore = (
        (experienceScore * config.experienceWeight) +
        (codingScore * config.codingWeight)
    ) / totalMainCategoryWeight;

    return {
        finalScore: Math.round(finalScore),
        experienceScore: Math.round(experienceScore),
        codingScore: Math.round(codingScore),
        normalizedWorkstyle: {
            aiAssist: hasAiAssistScore ? Math.round(normalizedAiAssist!) : null,
            problemSolving: hasProblemSolvingScore ? Math.round(workstyleMetrics.problemSolvingScore!) : null,
        },
    };
}
