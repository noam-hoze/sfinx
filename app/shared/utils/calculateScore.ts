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

const DEFAULT_SCORING_CONFIG: ScoringConfiguration = {
    aiAssistWeight: 25,
    problemSolvingWeight: 25,
    experienceWeight: 50,
    codingWeight: 50,
};

function clampPercent(value: number): number {
    return Math.min(100, Math.max(0, value));
}

function sanitizePercent(value: unknown, fallback = 0): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return fallback;
    }

    return clampPercent(value);
}

function sanitizeWeight(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return 0;
    }

    return value;
}

function sanitizeConfig(config: ScoringConfiguration): ScoringConfiguration {
    return {
        aiAssistWeight: sanitizePercent(config.aiAssistWeight, DEFAULT_SCORING_CONFIG.aiAssistWeight),
        problemSolvingWeight: sanitizePercent(config.problemSolvingWeight, DEFAULT_SCORING_CONFIG.problemSolvingWeight),
        experienceWeight: sanitizePercent(config.experienceWeight, DEFAULT_SCORING_CONFIG.experienceWeight),
        codingWeight: sanitizePercent(config.codingWeight, DEFAULT_SCORING_CONFIG.codingWeight),
    };
}

function sanitizeWorkstyleMetrics(workstyleMetrics: WorkstyleMetrics): WorkstyleMetrics {
    const aiAssist = sanitizePercent(workstyleMetrics.aiAssistAccountabilityScore, -1);
    const problemSolving = sanitizePercent(workstyleMetrics.problemSolvingScore, -1);

    return {
        aiAssistAccountabilityScore: aiAssist >= 0 ? aiAssist : undefined,
        problemSolvingScore: problemSolving >= 0 ? problemSolving : undefined,
    };
}

function calculateWeightedAverage(categories: Array<{ score: number; weight: number }>): number {
    let weightedSum = 0;
    let totalWeight = 0;

    categories.forEach(({ score, weight }) => {
        const safeWeight = sanitizeWeight(weight);
        if (safeWeight === 0) {
            return;
        }

        weightedSum += sanitizePercent(score) * safeWeight;
        totalWeight += safeWeight;
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

function calculateCodingScore(
    categoryAverage: number,
    workstyleMetrics: WorkstyleMetrics,
    config: ScoringConfiguration
): number {
    const remainingCategoryWeight = Math.max(0, 100 - config.aiAssistWeight - config.problemSolvingWeight);
    const categoryContribution = categoryAverage * remainingCategoryWeight / 100;
    const aiAssistContribution = (workstyleMetrics.aiAssistAccountabilityScore ?? 0) * config.aiAssistWeight / 100;
    const problemSolvingContribution = (workstyleMetrics.problemSolvingScore ?? 0) * config.problemSolvingWeight / 100;

    return clampPercent(categoryContribution + aiAssistContribution + problemSolvingContribution);
}

function calculateFinalScore(
    experienceScore: number,
    codingScore: number,
    config: ScoringConfiguration
): number {
    const totalMainCategoryWeight = config.experienceWeight + config.codingWeight;
    if (totalMainCategoryWeight <= 0) {
        return 0;
    }

    const weightedScore = (
        (experienceScore * config.experienceWeight) +
        (codingScore * config.codingWeight)
    ) / totalMainCategoryWeight;

    return clampPercent(weightedScore);
}

/**
 * Calculate final candidate score based on configuration
 */
export function calculateScore(
    rawScores: RawScores,
    workstyleMetrics: WorkstyleMetrics,
    config: ScoringConfiguration
): CalculatedScore {
    const safeConfig = sanitizeConfig(config);
    const safeWorkstyleMetrics = sanitizeWorkstyleMetrics(workstyleMetrics);
    const experienceScore = calculateWeightedAverage(rawScores.experienceScores);
    const categoryAverage = calculateWeightedAverage(rawScores.categoryScores);
    const codingScore = calculateCodingScore(categoryAverage, safeWorkstyleMetrics, safeConfig);
    const finalScore = calculateFinalScore(experienceScore, codingScore, safeConfig);
    const normalizedAiAssist = safeWorkstyleMetrics.aiAssistAccountabilityScore;
    const normalizedProblemSolving = safeWorkstyleMetrics.problemSolvingScore;

    return {
        finalScore: Math.round(finalScore),
        experienceScore: Math.round(experienceScore),
        codingScore: Math.round(codingScore),
        normalizedWorkstyle: {
            aiAssist: normalizedAiAssist !== undefined ? Math.round(normalizedAiAssist) : null,
            problemSolving: normalizedProblemSolving !== undefined ? Math.round(normalizedProblemSolving) : null,
        },
    };
}
