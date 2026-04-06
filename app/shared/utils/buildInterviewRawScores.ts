import type { RawScores } from "./calculateScore";

interface CategoryDefinition {
    name: string;
    weight?: number | null;
}

interface SummaryEntry {
    score?: number | null;
}

type SummaryMap = Record<string, SummaryEntry> | null | undefined;

interface InterviewScoreInputs {
    codingCategories?: CategoryDefinition[] | null;
    experienceCategories?: CategoryDefinition[] | null;
}

/**
 * Builds canonical raw score inputs from job definitions and stored summaries.
 */
export function buildInterviewRawScores(
    job: InterviewScoreInputs,
    backgroundSummary: { experienceCategories?: SummaryMap } | null | undefined,
    codingSummary: { jobSpecificCategories?: SummaryMap } | null | undefined
): RawScores {
    return {
        experienceScores: buildScoreEntries(
            job.experienceCategories,
            backgroundSummary?.experienceCategories
        ),
        categoryScores: buildScoreEntries(
            job.codingCategories,
            codingSummary?.jobSpecificCategories
        ),
    };
}

/**
 * Builds weighted score entries, zero-filling missing categories.
 */
function buildScoreEntries(
    definitions: CategoryDefinition[] | null | undefined,
    summary: SummaryMap
) {
    return (definitions ?? []).map(({ name, weight }) => ({
        name,
        score: getFiniteScore(summary?.[name]?.score),
        weight: normalizeWeight(weight),
    }));
}

/**
 * Returns a finite stored score or zero for missing category data.
 */
function getFiniteScore(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Returns the persisted category weight or the legacy default.
 */
function normalizeWeight(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 1;
}
