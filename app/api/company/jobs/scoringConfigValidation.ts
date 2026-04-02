interface ExistingWeights {
    aiAssistWeight?: number | null;
    problemSolvingWeight?: number | null;
    experienceWeight?: number | null;
    codingWeight?: number | null;
}

interface ExistingThresholds {
    iterationSpeedThresholdModerate?: number | null;
    iterationSpeedThresholdHigh?: number | null;
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

/**
 * Validates iteration thresholds while supporting partial updates.
 */
export function validateIterationThresholdConsistency(
    body: Record<string, unknown>,
    existing: ExistingThresholds
): string | null {
    const hasThresholdUpdate =
        body.iterationSpeedThresholdModerate !== undefined ||
        body.iterationSpeedThresholdHigh !== undefined;
    if (!hasThresholdUpdate) {
        return null;
    }

    const moderate =
        body.iterationSpeedThresholdModerate !== undefined
            ? Number(body.iterationSpeedThresholdModerate)
            : existing.iterationSpeedThresholdModerate ?? 5;
    const high =
        body.iterationSpeedThresholdHigh !== undefined
            ? Number(body.iterationSpeedThresholdHigh)
            : existing.iterationSpeedThresholdHigh ?? 10;

    if (moderate >= high) {
        return "Iteration speed moderate threshold must be less than high threshold";
    }

    return null;
}
