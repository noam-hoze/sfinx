import type { ScoringConfiguration } from "app/shared/utils/calculateScore";

/** Build a complete scoring config for profile-story score calculations. */
export function normalizeScoringConfig(
    scoringConfiguration: Partial<ScoringConfiguration> | null | undefined
): ScoringConfiguration {
    return {
        aiAssistWeight: scoringConfiguration?.aiAssistWeight ?? 25,
        problemSolvingWeight: scoringConfiguration?.problemSolvingWeight ?? 25,
        experienceWeight: scoringConfiguration?.experienceWeight ?? 50,
        codingWeight: scoringConfiguration?.codingWeight ?? 50,
    };
}
