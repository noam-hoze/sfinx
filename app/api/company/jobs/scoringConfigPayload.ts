/**
 * Shared scoring-config payload validation for company job APIs.
 */
export interface ScoringConfigWeights {
    aiAssistWeight: number;
    problemSolvingWeight: number;
    experienceWeight: number;
    codingWeight: number;
}

/**
 * Default scoring weights used when a job has no stored configuration yet.
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfigWeights = {
    aiAssistWeight: 25,
    problemSolvingWeight: 25,
    experienceWeight: 50,
    codingWeight: 50,
};

const WEIGHT_TOLERANCE = 0.01;

type WeightField = keyof ScoringConfigWeights;

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Scoring config is invalid");
    }
    return value as Record<string, unknown>;
}

function readWeight(
    body: Record<string, unknown>,
    field: WeightField,
    fallback: number
): number {
    if (body[field] === undefined) {
        return fallback;
    }
    const value = Number(body[field]);
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${field} must be a non-negative number`);
    }
    return value;
}

function validateTotals(config: ScoringConfigWeights) {
    const mainCategorySum = config.experienceWeight + config.codingWeight;
    if (Math.abs(mainCategorySum - 100) > WEIGHT_TOLERANCE) {
        throw new Error("Experience weight and coding weight must sum to 100");
    }

    const workstyleSum = config.aiAssistWeight + config.problemSolvingWeight;
    if (workstyleSum > 100) {
        throw new Error("aiAssistWeight and problemSolvingWeight cannot sum to more than 100");
    }
}

/**
 * Returns true when an error message came from scoring-config validation.
 */
export function isScoringConfigValidationMessage(message: string): boolean {
    return (
        message === "Scoring config is invalid" ||
        message === "Experience weight and coding weight must sum to 100" ||
        message ===
            "aiAssistWeight and problemSolvingWeight cannot sum to more than 100" ||
        message.endsWith("must be a non-negative number")
    );
}

/**
 * Resolves a partial scoring payload against persisted or default weights.
 */
export function resolveScoringConfigPayload(
    value: unknown,
    fallback: ScoringConfigWeights = DEFAULT_SCORING_CONFIG
): ScoringConfigWeights | null {
    if (value === undefined) {
        return null;
    }

    const body = asRecord(value);
    const config = {
        aiAssistWeight: readWeight(body, "aiAssistWeight", fallback.aiAssistWeight),
        problemSolvingWeight: readWeight(
            body,
            "problemSolvingWeight",
            fallback.problemSolvingWeight
        ),
        experienceWeight: readWeight(body, "experienceWeight", fallback.experienceWeight),
        codingWeight: readWeight(body, "codingWeight", fallback.codingWeight),
    };
    validateTotals(config);
    return config;
}
