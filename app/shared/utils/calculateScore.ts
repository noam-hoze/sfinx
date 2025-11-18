/**
 * Scoring calculation utility for candidate evaluation
 */

export interface ScoringConfiguration {
    // Experience dimension weights
    adaptabilityWeight: number;
    creativityWeight: number;
    reasoningWeight: number;
    // Coding dimension weights
    codeQualityWeight: number;
    problemSolvingWeight: number;
    // Workstyle metric weights
    iterationSpeedWeight: number;
    aiAssistWeight: number;
    // Category weights
    experienceWeight: number;
    codingWeight: number;
    // Workstyle benchmarks
    iterationSpeedThresholdModerate: number;
    iterationSpeedThresholdHigh: number;
}

export interface RawScores {
    // Experience scores (0-100)
    adaptability: number;
    creativity: number;
    reasoning: number;
    // Coding scores (0-100)
    codeQuality: number;
    problemSolving: number;
}

export interface WorkstyleMetrics {
    iterationSpeed?: number; // Raw count
    aiAssistAccountabilityScore?: number; // Already 0-100
}

export interface CalculatedScore {
    finalScore: number; // 0-100
    experienceScore: number; // 0-100 weighted average
    codingScore: number; // 0-100 weighted average including workstyle
    normalizedWorkstyle: {
        iterationSpeed: number; // 0-100
        aiAssist: number; // 0-100
    };
}

/**
 * Normalize iteration speed to 0-100 scale (inverse - lower is better)
 * 0 iterations = 100 score
 * thresholdModerate = 75 score
 * thresholdHigh = 50 score
 * > thresholdHigh = decreasing toward 0
 */
function normalizeIterationSpeed(
    value: number,
    thresholdModerate: number,
    thresholdHigh: number
): number {
    if (value === 0) return 100;
    if (value <= thresholdModerate) {
        // Linear interpolation from 100 to 75
        return 100 - ((value / thresholdModerate) * 25);
    }
    if (value <= thresholdHigh) {
        // Linear interpolation from 75 to 50
        const range = thresholdHigh - thresholdModerate;
        const position = (value - thresholdModerate) / range;
        return 75 - (position * 25);
    }
    // Beyond thresholdHigh, decrease toward 0
    // Cap at 2x threshold for 0 score
    const maxBad = thresholdHigh * 2;
    if (value >= maxBad) return 0;
    const range = maxBad - thresholdHigh;
    const position = (value - thresholdHigh) / range;
    return 50 - (position * 50);
}

/**
 * Calculate final candidate score based on configuration
 */
export function calculateScore(
    rawScores: RawScores,
    workstyleMetrics: WorkstyleMetrics,
    config: ScoringConfiguration
): CalculatedScore {
    // Normalize workstyle metrics to 0-100 scale
    const normalizedIterationSpeed = workstyleMetrics.iterationSpeed !== undefined
        ? normalizeIterationSpeed(
            workstyleMetrics.iterationSpeed,
            config.iterationSpeedThresholdModerate,
            config.iterationSpeedThresholdHigh
        )
        : 100; // Default to perfect if no data

    const normalizedAiAssist = workstyleMetrics.aiAssistAccountabilityScore ?? 100;

    // Calculate experience score (weighted average of 3 dimensions)
    const totalExperienceWeight = 
        config.adaptabilityWeight + 
        config.creativityWeight + 
        config.reasoningWeight;
    
    const experienceScore = (
        (rawScores.adaptability * config.adaptabilityWeight) +
        (rawScores.creativity * config.creativityWeight) +
        (rawScores.reasoning * config.reasoningWeight)
    ) / totalExperienceWeight;

    // Calculate coding score (weighted average of 2 coding dimensions + 2 workstyle metrics)
    const totalCodingWeight = 
        config.codeQualityWeight + 
        config.problemSolvingWeight + 
        config.iterationSpeedWeight +
        config.aiAssistWeight;
    
    const codingScore = (
        (rawScores.codeQuality * config.codeQualityWeight) +
        (rawScores.problemSolving * config.problemSolvingWeight) +
        (normalizedIterationSpeed * config.iterationSpeedWeight) +
        (normalizedAiAssist * config.aiAssistWeight)
    ) / totalCodingWeight;

    // Calculate final score (weighted average of experience and coding)
    const totalCategoryWeight = config.experienceWeight + config.codingWeight;
    const finalScore = (
        (experienceScore * config.experienceWeight) +
        (codingScore * config.codingWeight)
    ) / totalCategoryWeight;

    return {
        finalScore: Math.round(finalScore),
        experienceScore: Math.round(experienceScore),
        codingScore: Math.round(codingScore),
        normalizedWorkstyle: {
            iterationSpeed: Math.round(normalizedIterationSpeed),
            aiAssist: Math.round(normalizedAiAssist),
        },
    };
}

