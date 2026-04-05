/**
 * Validates scoring-weight totals for both full and partial updates.
 */
export function validateScoringWeightTotals(
    body: Record<string, unknown>,
    existingConfig?: {
        aiAssistWeight?: number | null;
        problemSolvingWeight?: number | null;
        experienceWeight?: number | null;
        codingWeight?: number | null;
    } | null
): string | null {
    const aiAssistWeight = body.aiAssistWeight !== undefined
        ? Number(body.aiAssistWeight)
        : (existingConfig?.aiAssistWeight ?? 25);
    const problemSolvingWeight = body.problemSolvingWeight !== undefined
        ? Number(body.problemSolvingWeight)
        : (existingConfig?.problemSolvingWeight ?? 25);
    if ((aiAssistWeight + problemSolvingWeight) > 100.01) {
        return "AI Assist weight and Problem Solving weight cannot exceed 100";
    }

    const experienceWeight = body.experienceWeight !== undefined
        ? Number(body.experienceWeight)
        : (existingConfig?.experienceWeight ?? 50);
    const codingWeight = body.codingWeight !== undefined
        ? Number(body.codingWeight)
        : (existingConfig?.codingWeight ?? 50);
    if (Math.abs((experienceWeight + codingWeight) - 100) > 0.01) {
        return "Experience weight and coding weight must sum to 100";
    }

    return null;
}
