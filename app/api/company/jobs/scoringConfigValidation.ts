interface ExistingWeights {
    aiAssistWeight?: number | null;
    problemSolvingWeight?: number | null;
    experienceWeight?: number | null;
    codingWeight?: number | null;
}

function readWeight(
    body: Record<string, unknown>,
    key: keyof ExistingWeights,
    existingValue: number | null | undefined,
    fallback: number
): number {
    return body[key] !== undefined ? Number(body[key]) : existingValue ?? fallback;
}

/**
 * Validates combined scoring weights while supporting partial updates.
 */
export function validateScoringWeightConsistency(
    body: Record<string, unknown>,
    existing: ExistingWeights
): string | null {
    const hasWorkstyleUpdate = body.aiAssistWeight !== undefined || body.problemSolvingWeight !== undefined;
    if (hasWorkstyleUpdate) {
        const aiAssistWeight = readWeight(body, "aiAssistWeight", existing.aiAssistWeight, 25);
        const problemSolvingWeight = readWeight(
            body,
            "problemSolvingWeight",
            existing.problemSolvingWeight,
            25
        );
        if (aiAssistWeight + problemSolvingWeight > 100.01) {
            return "AI Assist weight and Problem Solving weight must sum to 100 or less";
        }
    }

    const hasMainWeightUpdate = body.experienceWeight !== undefined || body.codingWeight !== undefined;
    if (hasMainWeightUpdate) {
        const experienceWeight = readWeight(body, "experienceWeight", existing.experienceWeight, 50);
        const codingWeight = readWeight(body, "codingWeight", existing.codingWeight, 50);
        if (Math.abs(experienceWeight + codingWeight - 100) > 0.01) {
            return "Experience weight and coding weight must sum to 100";
        }
    }

    return null;
}
