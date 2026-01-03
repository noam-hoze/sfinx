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
    // Workstyle metric weights
    aiAssistWeight: number;
    // Category weights
    experienceWeight: number;
    codingWeight: number;
}

export interface RawScores {
    // Experience scores (0-100)
    adaptability: number;
    creativity: number;
    reasoning: number;
    // Coding scores (0-100)
    codeQuality: number;
}

export interface WorkstyleMetrics {
    aiAssistAccountabilityScore?: number; // Already 0-100
}

export interface CalculatedScore {
    finalScore: number; // 0-100
    experienceScore: number; // 0-100 weighted average
    codingScore: number; // 0-100 weighted average including workstyle
    normalizedWorkstyle: {
        aiAssist: number | null; // 0-100
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
    const hasAiAssistScore = workstyleMetrics.aiAssistAccountabilityScore !== undefined && 
                              workstyleMetrics.aiAssistAccountabilityScore !== null;
    const normalizedAiAssist = workstyleMetrics.aiAssistAccountabilityScore;

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
    let codingWeightedSum = rawScores.codeQuality * config.codeQualityWeight;
    let totalCodingWeight = config.codeQualityWeight;
    
    // Only include AI assist if data exists
    if (hasAiAssistScore) {
        codingWeightedSum += normalizedAiAssist! * config.aiAssistWeight;
        totalCodingWeight += config.aiAssistWeight;
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
            aiAssist: hasAiAssistScore ? Math.round(normalizedAiAssist!) : null,
        },
    };
}

