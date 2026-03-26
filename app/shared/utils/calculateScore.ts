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
 * Returns a finite numeric value or a fallback when input is invalid.
 */
function finiteOr(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Normalizes a score-like value to a finite 0-100 number when present.
 */
function normalizeOptionalScore(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return undefined;
    }
    return Math.min(100, Math.max(0, value));
}

/**
 * Normalizes a score entry so invalid numbers cannot contaminate totals.
 */
function normalizeEntry(entry: { score: number; weight: number }) {
    return {
        score: Math.min(100, Math.max(0, finiteOr(entry.score, 0))),
        weight: Math.max(0, finiteOr(entry.weight, 0)),
    };
}

/**
 * Calculate final candidate score based on configuration
 */
export function calculateScore(
    rawScores: RawScores,
    workstyleMetrics: WorkstyleMetrics,
    config: ScoringConfiguration
): CalculatedScore {
    const normalizedAiAssist = normalizeOptionalScore(workstyleMetrics.aiAssistAccountabilityScore);
    const normalizedProblemSolving = normalizeOptionalScore(workstyleMetrics.problemSolvingScore);
    const hasAiAssistScore = normalizedAiAssist !== undefined;
    const hasProblemSolvingScore = normalizedProblemSolving !== undefined;
    const aiAssistWeight = Math.max(0, finiteOr(config.aiAssistWeight, 0));
    const problemSolvingWeight = Math.max(0, finiteOr(config.problemSolvingWeight, 0));
    const experienceWeight = Math.max(0, finiteOr(config.experienceWeight, 0));
    const codingWeight = Math.max(0, finiteOr(config.codingWeight, 0));

    // Calculate experience score from dynamic categories (same pattern as coding)
    let experienceWeightedSum = 0;
    let totalExperienceWeight = 0;

    rawScores.experienceScores.forEach(category => {
        const normalized = normalizeEntry(category);
        if (normalized.weight > 0) {
            experienceWeightedSum += normalized.score * normalized.weight;
            totalExperienceWeight += normalized.weight;
        }
    });

    const experienceScore = totalExperienceWeight > 0 ? experienceWeightedSum / totalExperienceWeight : 0;

    // Calculate coding score from category scores with their individual weights
    // Step 1: Calculate weighted average of categories (user enters weights thinking of them as 100%)
    let categoryWeightedSum = 0;
    let totalCategoryWeight = 0;

    rawScores.categoryScores.forEach(category => {
        const normalized = normalizeEntry(category);
        if (normalized.weight > 0) {
            categoryWeightedSum += normalized.score * normalized.weight;
            totalCategoryWeight += normalized.weight;
        }
    });

    const categoryAverage = totalCategoryWeight > 0 ? categoryWeightedSum / totalCategoryWeight : 0;

    // Step 2: Categories contribute (100 - aiAssistWeight - problemSolvingWeight)% of coding score
    const categoryWeightShare = Math.max(0, 100 - aiAssistWeight - problemSolvingWeight);
    const categoryContribution = categoryAverage * categoryWeightShare / 100;

    // Step 3: AI assist contributes its percentage of the coding score
    const aiAssistContribution = hasAiAssistScore
        ? normalizedAiAssist * aiAssistWeight / 100
        : 0;

    // Step 4: Problem solving contributes its percentage of the coding score
    const problemSolvingContribution = hasProblemSolvingScore
        ? normalizedProblemSolving * problemSolvingWeight / 100
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
            aiAssist: hasAiAssistScore ? Math.round(normalizedAiAssist) : null,
            problemSolving: hasProblemSolvingScore ? Math.round(normalizedProblemSolving) : null,
        },
    };
}
