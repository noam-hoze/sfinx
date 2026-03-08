import {
    CREATION_BACKGROUND_CONTRIBUTIONS_TARGET,
    CREATION_CODING_CONTRIBUTIONS_TARGET,
} from "shared/constants/interview";

/**
 * Helpers for validating and building scoring configuration mutation payloads.
 */

export interface ScoringConfigValues {
    aiAssistWeight: number;
    experienceWeight: number;
    codingWeight: number;
    backgroundContributionsTarget: number;
    codingContributionsTarget: number;
}

export const DEFAULT_SCORING_CONFIG_VALUES: ScoringConfigValues = {
    aiAssistWeight: 25,
    experienceWeight: 50,
    codingWeight: 50,
    backgroundContributionsTarget: CREATION_BACKGROUND_CONTRIBUTIONS_TARGET,
    codingContributionsTarget: CREATION_CODING_CONTRIBUTIONS_TARGET,
};

/**
 * Coerces a mutation input to a finite number or returns the explicit default.
 */
function coerceNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
        return parsed;
    }
    return fallback;
}

/**
 * Coerces a mutation input to a positive integer or returns the explicit default.
 */
function coercePositiveInteger(value: unknown, fallback: number): number {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0) {
        return parsed;
    }
    return fallback;
}

/**
 * Validates scoring configuration fields supplied by a company mutation request.
 */
export function validateScoringConfigInput(input: Record<string, unknown>): string | null {
    const weightFields = [
        "aiAssistWeight",
        "experienceWeight",
        "codingWeight",
    ] as const;
    const targetFields = [
        "backgroundContributionsTarget",
        "codingContributionsTarget",
    ] as const;

    for (const field of weightFields) {
        if (input[field] !== undefined) {
            const value = Number(input[field]);
            if (!Number.isFinite(value) || value < 0) {
                return `${field} must be a positive number`;
            }
        }
    }

    for (const field of targetFields) {
        if (input[field] !== undefined) {
            const value = Number(input[field]);
            if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
                return `${field} must be a positive integer`;
            }
        }
    }

    if (input.experienceWeight !== undefined && input.codingWeight !== undefined) {
        const sum = Number(input.experienceWeight) + Number(input.codingWeight);
        if (Math.abs(sum - 100) > 0.01) {
            return "Experience weight and coding weight must sum to 100";
        }
    }

    return null;
}

/**
 * Builds a complete scoring configuration payload for explicit create or upsert paths.
 */
export function buildScoringConfigValues(
    input?: Partial<ScoringConfigValues> | null
): ScoringConfigValues {
    return {
        aiAssistWeight: coerceNumber(
            input?.aiAssistWeight,
            DEFAULT_SCORING_CONFIG_VALUES.aiAssistWeight
        ),
        experienceWeight: coerceNumber(
            input?.experienceWeight,
            DEFAULT_SCORING_CONFIG_VALUES.experienceWeight
        ),
        codingWeight: coerceNumber(
            input?.codingWeight,
            DEFAULT_SCORING_CONFIG_VALUES.codingWeight
        ),
        backgroundContributionsTarget: coercePositiveInteger(
            input?.backgroundContributionsTarget,
            DEFAULT_SCORING_CONFIG_VALUES.backgroundContributionsTarget
        ),
        codingContributionsTarget: coercePositiveInteger(
            input?.codingContributionsTarget,
            DEFAULT_SCORING_CONFIG_VALUES.codingContributionsTarget
        ),
    };
}
