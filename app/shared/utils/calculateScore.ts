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
 * Matches the Prisma defaults for jobs without a persisted scoring config row.
 */
const DEFAULT_SCORING_CONFIGURATION: ScoringConfiguration = {
    aiAssistWeight: 25,
    problemSolvingWeight: 25,
    experienceWeight: 50,
    codingWeight: 50,
};

/**
 * Require numeric weights for non-legacy scoring config fields.
 */
function requireWeight(field: string, value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    throw new Error(`Missing scoring configuration weight: ${field}`);
}

/**
 * Reject configs that reserve more than 100% of coding for workstyle metrics.
 */
function validateWorkstyleWeightBudget(aiAssistWeight: number, problemSolvingWeight: number) {
    if (aiAssistWeight + problemSolvingWeight > 100) {
        throw new Error("AI Assist weight and Problem Solving weight must sum to 100 or less");
    }
}

/**
 * Unmeasurable problem-solving should not consume coding weight.
 */
function getProblemSolvingWeight(weight: number, hasProblemSolvingScore: boolean) {
    return hasProblemSolvingScore ? weight : 0;
}

/**
 * Normalize scoring config while preserving legacy jobs without problem-solving weight.
 */
export function normalizeScoringConfiguration(
    config: Partial<ScoringConfiguration> | null | undefined
): ScoringConfiguration {
    if (!config) {
        return DEFAULT_SCORING_CONFIGURATION;
    }

    const normalizedConfig = {
        aiAssistWeight: requireWeight("aiAssistWeight", config?.aiAssistWeight),
        problemSolvingWeight: config.problemSolvingWeight == null
            ? 0
            : requireWeight("problemSolvingWeight", config.problemSolvingWeight),
        experienceWeight: requireWeight("experienceWeight", config?.experienceWeight),
        codingWeight: requireWeight("codingWeight", config?.codingWeight),
    };

    validateWorkstyleWeightBudget(
        normalizedConfig.aiAssistWeight,
        normalizedConfig.problemSolvingWeight
    );

    return normalizedConfig;
}

/**
 * Calculate final candidate score based on configuration.
 */
export function calculateScore(
    rawScores: RawScores,
    workstyleMetrics: WorkstyleMetrics,
    config: Partial<ScoringConfiguration> | null | undefined
): CalculatedScore {
    const normalizedConfig = normalizeScoringConfiguration(config);
    const aiAssistWeight = normalizedConfig.aiAssistWeight;
    const experienceWeight = normalizedConfig.experienceWeight;
    const codingWeight = normalizedConfig.codingWeight;

    const hasAiAssistScore = workstyleMetrics.aiAssistAccountabilityScore !== undefined &&
                              workstyleMetrics.aiAssistAccountabilityScore !== null;
    const normalizedAiAssist = workstyleMetrics.aiAssistAccountabilityScore;

    const hasProblemSolvingScore = workstyleMetrics.problemSolvingScore !== undefined &&
                                    workstyleMetrics.problemSolvingScore !== null;
    const problemSolvingWeight = getProblemSolvingWeight(
        normalizedConfig.problemSolvingWeight,
        hasProblemSolvingScore
    );

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

    // Step 2: Categories contribute (100 - aiAssistWeight - problemSolvingWeight)% of coding score
    const categoryContribution = categoryAverage * (100 - aiAssistWeight - problemSolvingWeight) / 100;

    // Step 3: AI assist contributes its percentage of the coding score
    const aiAssistContribution = hasAiAssistScore
        ? normalizedAiAssist! * aiAssistWeight / 100
        : 0;

    // Step 4: Problem solving contributes its percentage of the coding score
    const problemSolvingContribution = hasProblemSolvingScore
        ? workstyleMetrics.problemSolvingScore! * problemSolvingWeight / 100
        : 0;

    // Step 5: Final coding score (0-100)
    const codingScore = categoryContribution + aiAssistContribution + problemSolvingContribution;

    // Calculate final score (weighted average of experience and coding)
    const totalMainCategoryWeight = experienceWeight + codingWeight;
    const finalScore = totalMainCategoryWeight > 0
        ? (
            (experienceScore * experienceWeight) +
            (codingScore * codingWeight)
        ) / totalMainCategoryWeight
        : 0;

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
