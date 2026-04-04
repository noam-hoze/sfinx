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
 * Returns a finite runtime number or null when the value is invalid.
 */
function toFiniteNumber(value: number | undefined | null): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Returns a positive finite weight or 0 when the value is invalid.
 */
function toPositiveWeight(value: number | undefined | null): number {
    const weight = toFiniteNumber(value);
    return weight !== null && weight > 0 ? weight : 0;
}

/**
 * Calculates a weighted average while skipping invalid score data.
 */
function calculateWeightedAverage(
    categories: Array<{score: number; weight: number}>
): number {
    let weightedSum = 0;
    let totalWeight = 0;

    categories.forEach(category => {
        const score = toFiniteNumber(category.score);
        const weight = toPositiveWeight(category.weight);

        if (score === null || weight === 0) {
            return;
        }

        weightedSum += score * weight;
        totalWeight += weight;
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Calculate final candidate score based on configuration
 */
export function calculateScore(
    rawScores: RawScores,
    workstyleMetrics: WorkstyleMetrics,
    config: ScoringConfiguration
): CalculatedScore {
    const normalizedAiAssist = toFiniteNumber(workstyleMetrics.aiAssistAccountabilityScore);
    const normalizedProblemSolving = toFiniteNumber(workstyleMetrics.problemSolvingScore);
    const sanitizedConfig = {
        aiAssistWeight: toPositiveWeight(config.aiAssistWeight),
        problemSolvingWeight: toPositiveWeight(config.problemSolvingWeight),
        experienceWeight: toPositiveWeight(config.experienceWeight),
        codingWeight: toPositiveWeight(config.codingWeight),
    };
    const experienceScore = calculateWeightedAverage(rawScores.experienceScores);
    const categoryAverage = calculateWeightedAverage(rawScores.categoryScores);

    // Step 2: Categories contribute (100 - aiAssistWeight - problemSolvingWeight)% of coding score
    const categoryContribution = categoryAverage *
        (100 - sanitizedConfig.aiAssistWeight - sanitizedConfig.problemSolvingWeight) / 100;

    // Step 3: AI assist contributes its percentage of the coding score
    const aiAssistContribution = normalizedAiAssist !== null
        ? normalizedAiAssist * sanitizedConfig.aiAssistWeight / 100
        : 0;

    // Step 4: Problem solving contributes its percentage of the coding score
    const problemSolvingContribution = normalizedProblemSolving !== null
        ? normalizedProblemSolving * sanitizedConfig.problemSolvingWeight / 100
        : 0;

    // Step 5: Final coding score (0-100)
    const codingScore = categoryContribution + aiAssistContribution + problemSolvingContribution;

    // Calculate final score (weighted average of experience and coding)
    const totalMainCategoryWeight = sanitizedConfig.experienceWeight + sanitizedConfig.codingWeight;
    const finalScore = totalMainCategoryWeight > 0
        ? (
            (experienceScore * sanitizedConfig.experienceWeight) +
            (codingScore * sanitizedConfig.codingWeight)
        ) / totalMainCategoryWeight
        : 0;

    return {
        finalScore: Math.round(finalScore),
        experienceScore: Math.round(experienceScore),
        codingScore: Math.round(codingScore),
        normalizedWorkstyle: {
            aiAssist: normalizedAiAssist !== null ? Math.round(normalizedAiAssist) : null,
            problemSolving: normalizedProblemSolving !== null ? Math.round(normalizedProblemSolving) : null,
        },
    };
}
