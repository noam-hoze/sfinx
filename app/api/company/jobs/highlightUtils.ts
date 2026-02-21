/**
 * Extracts top 2-3 category highlights from interview session data.
 * Shared utility used by both per-job and all-applicants API routes.
 */
export function extractTopHighlights(session: any): string[] {
  const telemetryArray = Array.isArray(session?.telemetryData)
    ? session.telemetryData
    : session?.telemetryData
      ? [session.telemetryData]
      : [];

  if (telemetryArray.length === 0) {
    return [];
  }

  const telemetry = telemetryArray[0];
  const allCategories: Array<{ name: string; score: number }> = [];

  if (telemetry.backgroundSummary?.experienceCategories) {
    const expCats = telemetry.backgroundSummary.experienceCategories;
    Object.entries(expCats).forEach(([key, value]: [string, any]) => {
      if (value?.score != null) {
        allCategories.push({ name: value.name || key, score: value.score });
      }
    });
  }

  if (telemetry.codingSummary?.jobSpecificCategories) {
    const codeCats = telemetry.codingSummary.jobSpecificCategories;
    Object.entries(codeCats).forEach(([key, value]: [string, any]) => {
      if (value?.score != null) {
        allCategories.push({ name: value.name || key, score: value.score });
      }
    });
  }

  return allCategories
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c) => c.name);
}
