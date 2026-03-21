/**
 * Shared scoring configuration shape for company job forms.
 */
export interface ScoringConfigState {
    aiAssistWeight: number;
    problemSolvingWeight: number;
    experienceWeight: number;
    codingWeight: number;
}

/**
 * Default scoring weights used by new company job forms.
 */
export const defaultScoringConfig: ScoringConfigState = {
    aiAssistWeight: 25,
    problemSolvingWeight: 25,
    experienceWeight: 50,
    codingWeight: 50,
};

const WEIGHT_TOLERANCE = 0.01;
const WEIGHT_FIELDS: Array<keyof ScoringConfigState> = [
    "aiAssistWeight",
    "problemSolvingWeight",
    "experienceWeight",
    "codingWeight",
];

function getWeightValidationError(config: ScoringConfigState): string | null {
    for (const field of WEIGHT_FIELDS) {
        const value = config[field];
        if (!Number.isFinite(value) || value < 0) {
            return `${field} must be a non-negative number.`;
        }
    }
    return null;
}

/**
 * Returns a submission error when the scoring config would fail API validation.
 */
export function getScoringConfigValidationError(
    config: ScoringConfigState
): string | null {
    const weightError = getWeightValidationError(config);
    if (weightError) {
        return weightError;
    }

    const mainCategorySum = config.experienceWeight + config.codingWeight;
    if (Math.abs(mainCategorySum - 100) > WEIGHT_TOLERANCE) {
        return "Experience weight and coding weight must sum to 100.";
    }

    const workstyleSum = config.aiAssistWeight + config.problemSolvingWeight;
    if (workstyleSum > 100) {
        return "aiAssistWeight and problemSolvingWeight cannot sum to more than 100.";
    }

    return null;
}
