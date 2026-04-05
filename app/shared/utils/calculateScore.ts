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
    experienceScores: RawScoreEntry[];
    // Coding category scores with weights
    categoryScores: RawScoreEntry[];
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
 * Validates an individual scoring weight before score calculation.
 */
function assertValidWeight(name: keyof ScoringConfiguration, value: number): void {
    if (!Number.isFinite(value)) {
        throw new Error(`Invalid scoring configuration: ${name} must be a finite number`);
    }
    if (value < 0) {
        throw new Error(`Invalid scoring configuration: ${name} must be non-negative`);
    }
}

/**
 * Validates one raw category weight from runtime data.
 */
function assertValidRawWeight(group: string, entry: RawScoreEntry): void {
    if (!Number.isFinite(entry.weight)) {
        throw new Error(`Invalid scoring weight for ${group} category "${entry.name}": weight must be a finite number`);
    }
    if (entry.weight < 0) {
        throw new Error(`Invalid scoring weight for ${group} category "${entry.name}": weight must be non-negative`);
    }
}

/**
 * Rejects incomplete or inconsistent scoring-weight totals.
 */
function validateScoringConfiguration(config: ScoringConfiguration): void {
    assertValidWeight("aiAssistWeight", config.aiAssistWeight);
    assertValidWeight("problemSolvingWeight", config.problemSolvingWeight);
    assertValidWeight("experienceWeight", config.experienceWeight);
    assertValidWeight("codingWeight", config.codingWeight);
    if ((config.aiAssistWeight + config.problemSolvingWeight) > 100.01) {
        throw new Error("Invalid scoring configuration: AI Assist weight and Problem Solving weight cannot exceed 100");
    }
    if (Math.abs((config.experienceWeight + config.codingWeight) - 100) > 0.01) {
        throw new Error("Invalid scoring configuration: Experience weight and coding weight must sum to 100");
    }
}

/**
 * Rejects invalid category weights from persisted runtime data.
 */
function validateRawScoreWeights(rawScores: RawScores): void {
    rawScores.experienceScores.forEach(entry => assertValidRawWeight("experience", entry));
    rawScores.categoryScores.forEach(entry => assertValidRawWeight("coding", entry));
}

/**
 * Calculates a weighted average while ignoring zero-weight categories.
 */
function calculateWeightedAverage(scores: RawScoreEntry[]): number {
    let weightedSum = 0;
    let totalWeight = 0;
    scores.forEach(category => {
        if (category.weight > 0 && Number.isFinite(category.score)) {
            weightedSum += category.score * category.weight;
            totalWeight += category.weight;
        }
    });
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Normalizes optional workstyle metrics and drops malformed numbers.
 */
function readMetric(value: number | undefined): number | undefined {
    return Number.isFinite(value) ? value : undefined;
}

/**
 * Calculates the coding score from categories and workstyle metrics.
 */
function calculateCodingScore(
    categoryAverage: number,
    workstyleMetrics: WorkstyleMetrics,
    config: ScoringConfiguration
): number {
    const aiAssistScore = readMetric(workstyleMetrics.aiAssistAccountabilityScore);
    const problemSolvingScore = readMetric(workstyleMetrics.problemSolvingScore);
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
    const metric = readMetric(value);
    return metric === undefined ? null : Math.round(metric);
}

/**
 * Creates a raw score entry without silently defaulting category weights.
 */
export function createRawScoreEntry(name: string, score: unknown, weight: unknown): RawScoreEntry {
    return {
        name,
        score: score === undefined || score === null ? 0 : Number(score),
        weight: weight === undefined || weight === null ? Number.NaN : Number(weight),
    };
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
    validateRawScoreWeights(rawScores);
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
