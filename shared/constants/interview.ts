/**
 * Contribution-target defaults for explicit creation-time flows only.
 */

export const CREATION_BACKGROUND_CONTRIBUTIONS_TARGET = 5;
export const CREATION_CODING_CONTRIBUTIONS_TARGET = 5;

type ContributionTargetConfig =
    | {
          backgroundContributionsTarget?: unknown;
          codingContributionsTarget?: unknown;
      }
    | null
    | undefined;

/**
 * Validates that a persisted contribution target exists and is usable.
 */
function requireContributionTarget(
    value: unknown,
    fieldName: string,
    context: string
): number {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0) {
        return parsed;
    }
    throw new Error(`Missing valid ${fieldName} for ${context}`);
}

/**
 * Reads the persisted background contribution target for an interview context.
 */
export function requireBackgroundContributionsTarget(
    config: ContributionTargetConfig,
    context: string
): number {
    if (!config) {
        throw new Error(`Missing scoring configuration for ${context}`);
    }
    return requireContributionTarget(
        config.backgroundContributionsTarget,
        "backgroundContributionsTarget",
        context
    );
}

/**
 * Reads the persisted coding contribution target for an interview context.
 */
export function requireCodingContributionsTarget(
    config: ContributionTargetConfig,
    context: string
): number {
    if (!config) {
        throw new Error(`Missing scoring configuration for ${context}`);
    }
    return requireContributionTarget(
        config.codingContributionsTarget,
        "codingContributionsTarget",
        context
    );
}
