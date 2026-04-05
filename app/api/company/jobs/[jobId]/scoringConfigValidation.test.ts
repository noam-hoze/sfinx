import { describe, expect, it } from "vitest";
import { validateScoringWeightTotals } from "./scoringConfigValidation";

describe("validateScoringWeightTotals", () => {
    it("rejects when workstyle weights exceed 100 with partial payload + existing config", () => {
        const error = validateScoringWeightTotals(
            { problemSolvingWeight: 40 },
            { aiAssistWeight: 70, problemSolvingWeight: 25, experienceWeight: 50, codingWeight: 50 }
        );
        expect(error).toBe("AI Assist weight and Problem Solving weight cannot exceed 100");
    });

    it("rejects when experience + coding do not sum to 100 with partial payload", () => {
        const error = validateScoringWeightTotals(
            { experienceWeight: 60 },
            { aiAssistWeight: 25, problemSolvingWeight: 25, experienceWeight: 50, codingWeight: 50 }
        );
        expect(error).toBe("Experience weight and coding weight must sum to 100");
    });

    it("accepts valid mixed values", () => {
        const error = validateScoringWeightTotals(
            { aiAssistWeight: 30, problemSolvingWeight: 20 },
            { aiAssistWeight: 25, problemSolvingWeight: 25, experienceWeight: 50, codingWeight: 50 }
        );
        expect(error).toBeNull();
    });
});
