import { describe, expect, it } from "vitest";
import { validateScoringWeightConsistency } from "./scoringConfigValidation";

describe("validateScoringWeightConsistency", () => {
    it("allows valid partial workstyle updates", () => {
        const error = validateScoringWeightConsistency(
            { aiAssistWeight: 40 },
            { problemSolvingWeight: 50, experienceWeight: 50, codingWeight: 50 }
        );
        expect(error).toBeNull();
    });

    it("rejects workstyle updates when aiAssist + problemSolving exceeds 100", () => {
        const error = validateScoringWeightConsistency(
            { aiAssistWeight: 60 },
            { problemSolvingWeight: 50, experienceWeight: 50, codingWeight: 50 }
        );
        expect(error).toBe("AI Assist weight and Problem Solving weight must sum to 100 or less");
    });

    it("allows valid partial main-weight updates", () => {
        const error = validateScoringWeightConsistency(
            { experienceWeight: 45 },
            { aiAssistWeight: 25, problemSolvingWeight: 25, codingWeight: 55 }
        );
        expect(error).toBeNull();
    });

    it("rejects partial main-weight updates when experience + coding is not 100", () => {
        const error = validateScoringWeightConsistency(
            { codingWeight: 60 },
            { aiAssistWeight: 25, problemSolvingWeight: 25, experienceWeight: 50 }
        );
        expect(error).toBe("Experience weight and coding weight must sum to 100");
    });

    it("uses defaults for new configurations without existing values", () => {
        const error = validateScoringWeightConsistency(
            { aiAssistWeight: 80 },
            {}
        );
        expect(error).toBe("AI Assist weight and Problem Solving weight must sum to 100 or less");
    });
});
