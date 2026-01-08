/**
 * Scoring calculation utility for candidate evaluation
 */

export interface ScoringConfiguration {
    // Workstyle metric weights
    aiAssistWeight: number;
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
    let codingWeightedSum = 0;
    let totalCodingWeight = 0;
    
    // Add all category scores with their weights
    rawScores.categoryScores.forEach(category => {
        if (category.weight > 0) {
            codingWeightedSum += category.score * category.weight;
            totalCodingWeight += category.weight;
        }
    });
    
    // Only include AI assist if data exists
    if (hasAiAssistScore) {
        codingWeightedSum += normalizedAiAssist! * config.aiAssistWeight;
        totalCodingWeight += config.aiAssistWeight;
    }
    
    const codingScore = totalCodingWeight > 0 ? codingWeightedSum / totalCodingWeight : 0;

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

