import { describe, expect, it } from "vitest";
import {
    defaultScoringConfig,
    getScoringConfigValidationError,
} from "./scoringConfigValidation";

describe("getScoringConfigValidationError", () => {
    it("returns null for the default config", () => {
        expect(getScoringConfigValidationError(defaultScoringConfig)).toBeNull();
    });

    it("rejects invalid main category totals", () => {
        expect(
            getScoringConfigValidationError({
                ...defaultScoringConfig,
                codingWeight: 60,
            })
        ).toBe("Experience weight and coding weight must sum to 100.");
    });

    it("rejects invalid workstyle totals", () => {
        expect(
            getScoringConfigValidationError({
                ...defaultScoringConfig,
                aiAssistWeight: 80,
            })
        ).toBe(
            "aiAssistWeight and problemSolvingWeight cannot sum to more than 100."
        );
    });

    it("rejects negative weights", () => {
        expect(
            getScoringConfigValidationError({
                ...defaultScoringConfig,
                codingWeight: -1,
            })
        ).toBe("codingWeight must be a non-negative number.");
    });

    it("accepts workstyle totals at 100", () => {
        expect(
            getScoringConfigValidationError({
                ...defaultScoringConfig,
                aiAssistWeight: 60,
                problemSolvingWeight: 40,
            })
        ).toBeNull();
    });
});
