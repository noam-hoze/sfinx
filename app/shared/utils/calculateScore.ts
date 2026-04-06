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

interface WeightedScoreEntry {
    score: number;
    weight: number;
}

/**
 * Checks whether a value is a finite number.
 */
function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

/**
 * Sanitizes untrusted weight values before score math.
 */
function normalizeWeight(value: unknown): number {
    return isFiniteNumber(value) && value >= 0 ? value : 0;
}

/**
 * Returns a finite workstyle score or null when the input is invalid.
 */
function getFiniteMetric(value: unknown): number | null {
    return isFiniteNumber(value) ? value : null;
}

/**
 * Builds a safe scoring configuration from persisted job data.
 */
function normalizeConfig(config: ScoringConfiguration): ScoringConfiguration {
    return {
        aiAssistWeight: normalizeWeight(config.aiAssistWeight),
        problemSolvingWeight: normalizeWeight(config.problemSolvingWeight),
        experienceWeight: normalizeWeight(config.experienceWeight),
        codingWeight: normalizeWeight(config.codingWeight),
    };
}

/**
 * Calculates a weighted average from finite score entries only.
 */
function calculateWeightedAverage(entries: WeightedScoreEntry[]): number {
    let weightedSum = 0;
    let totalWeight = 0;

    entries.forEach(({ score, weight }) => {
        if (!isFiniteNumber(score) || !isFiniteNumber(weight) || weight <= 0) {
            return;
        }

        weightedSum += score * weight;
        totalWeight += weight;
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Calculates the coding score from categories and workstyle inputs.
 */
function calculateCodingScore(
    categoryAverage: number,
    aiAssistScore: number | null,
    problemSolvingScore: number | null,
    config: ScoringConfiguration
): number {
    const categoryContribution =
        (categoryAverage * (100 - config.aiAssistWeight - config.problemSolvingWeight)) / 100;
    const aiAssistContribution =
        aiAssistScore !== null ? (aiAssistScore * config.aiAssistWeight) / 100 : 0;
    const problemSolvingContribution =
        problemSolvingScore !== null ? (problemSolvingScore * config.problemSolvingWeight) / 100 : 0;

    return categoryContribution + aiAssistContribution + problemSolvingContribution;
}

/**
 * Calculates the final blended score from main category weights.
 */
function calculateFinalScore(
    experienceScore: number,
    codingScore: number,
    config: ScoringConfiguration
): number {
    const totalMainCategoryWeight = config.experienceWeight + config.codingWeight;

    if (totalMainCategoryWeight <= 0) {
        return 0;
    }

    return (
        (experienceScore * config.experienceWeight) +
        (codingScore * config.codingWeight)
    ) / totalMainCategoryWeight;
}

/**
 * Calculate final candidate score based on configuration
 */
export function calculateScore(
    rawScores: RawScores,
    workstyleMetrics: WorkstyleMetrics,
    config: ScoringConfiguration
): CalculatedScore {
    const safeConfig = normalizeConfig(config);
    const aiAssistScore = getFiniteMetric(workstyleMetrics.aiAssistAccountabilityScore);
    const problemSolvingScore = getFiniteMetric(workstyleMetrics.problemSolvingScore);
    const experienceScore = calculateWeightedAverage(rawScores.experienceScores);
    const categoryAverage = calculateWeightedAverage(rawScores.categoryScores);
    const codingScore = calculateCodingScore(
        categoryAverage,
        aiAssistScore,
        problemSolvingScore,
        safeConfig
    );
    const finalScore = calculateFinalScore(experienceScore, codingScore, safeConfig);

    return {
        finalScore: Math.round(finalScore),
        experienceScore: Math.round(experienceScore),
        codingScore: Math.round(codingScore),
        normalizedWorkstyle: {
            aiAssist: aiAssistScore !== null ? Math.round(aiAssistScore) : null,
            problemSolving: problemSolvingScore !== null ? Math.round(problemSolvingScore) : null,
        },
    };
}
