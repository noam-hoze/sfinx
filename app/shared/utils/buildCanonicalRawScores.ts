import type { RawScores } from "./calculateScore";

interface WeightedCategoryDefinition {
    name: string;
    weight?: unknown;
}

type ScoreSummaryMap = Record<string, { score?: unknown }> | null | undefined;

/**
 * Returns the numeric score stored for a category, defaulting missing values to zero.
 */
function readScoreValue(value: unknown): number {
    return typeof value === "number" ? value : 0;
}

/**
 * Preserves explicit zero weights while defaulting missing weights to one.
 */
function readWeightValue(value: unknown): number {
    if (value === null || value === undefined) {
        return 1;
    }
    return typeof value === "number" ? value : 1;
}

/**
 * Maps configured job categories to canonical raw-score entries.
 */
function mapConfiguredCategories(
    definitions: WeightedCategoryDefinition[] | null | undefined,
    scoresByName: ScoreSummaryMap
) {
    return (definitions ?? []).map(category => ({
        name: category.name,
        score: readScoreValue(scoresByName?.[category.name]?.score),
        weight: readWeightValue(category.weight),
    }));
}

/**
 * Builds raw score inputs using configured job categories as the source of truth.
 */
export function buildCanonicalRawScores(params: {
    experienceCategoryDefinitions: WeightedCategoryDefinition[] | null | undefined;
    experienceCategoryScores: ScoreSummaryMap;
    codingCategoryDefinitions: WeightedCategoryDefinition[] | null | undefined;
    codingCategoryScores: ScoreSummaryMap;
}): RawScores {
    return {
        experienceScores: mapConfiguredCategories(
            params.experienceCategoryDefinitions,
            params.experienceCategoryScores
        ),
        categoryScores: mapConfiguredCategories(
            params.codingCategoryDefinitions,
            params.codingCategoryScores
        ),
    };
}
