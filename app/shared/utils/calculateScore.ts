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
 * Normalize iteration speed to 0-100 scale
 * Represents "iterations until first CORRECT solution"
 * Lower = better (more efficient problem solving)
 * 1 iteration = 100 score (perfect on first try)
 * thresholdModerate (5) = 75 score
 * thresholdHigh (10) = 50 score
 * > thresholdHigh = decreasing toward 0
 */
function normalizeIterationSpeed(
    value: number,
    thresholdModerate: number,
    thresholdHigh: number
): number {
    // value represents "iterations until first CORRECT solution"
    // Lower is better: 1 iteration = perfect, many iterations = poor
    if (value <= 1) return 100; // Perfect: got it right on first try
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
    const hasIterationSpeed = workstyleMetrics.iterationSpeed !== undefined && 
                               workstyleMetrics.iterationSpeed !== null;
    
    const normalizedIterationSpeed = hasIterationSpeed
        ? normalizeIterationSpeed(
            workstyleMetrics.iterationSpeed!,
            config.iterationSpeedThresholdModerate,
            config.iterationSpeedThresholdHigh
        )
        : null;

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

    // Calculate coding score (weighted average, excluding metrics not applicable)
    let codingWeightedSum = 
        (rawScores.codeQuality * config.codeQualityWeight) +
        (rawScores.problemSolving * config.problemSolvingWeight) +
        (normalizedAiAssist * config.aiAssistWeight);
    
    let totalCodingWeight = 
        config.codeQualityWeight + 
        config.problemSolvingWeight + 
        config.aiAssistWeight;
    
    // Only include iteration speed if candidate achieved a correct solution
    if (normalizedIterationSpeed !== null) {
        codingWeightedSum += normalizedIterationSpeed * config.iterationSpeedWeight;
        totalCodingWeight += config.iterationSpeedWeight;
    }
    
    const codingScore = codingWeightedSum / totalCodingWeight;

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

