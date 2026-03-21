import { describe, expect, it } from "vitest";
import {
    DEFAULT_SCORING_CONFIG,
    resolveScoringConfigPayload,
} from "./scoringConfigPayload";

describe("resolveScoringConfigPayload", () => {
    it("rejects null weight values", () => {
        expect(() =>
            resolveScoringConfigPayload({ aiAssistWeight: null })
        ).toThrow("aiAssistWeight must be a non-negative number");
    });

    it("rejects boolean weight values", () => {
        expect(() =>
            resolveScoringConfigPayload({ problemSolvingWeight: true })
        ).toThrow("problemSolvingWeight must be a non-negative number");
    });

    it("rejects empty string weight values", () => {
        expect(() =>
            resolveScoringConfigPayload({ codingWeight: "" })
        ).toThrow("codingWeight must be a non-negative number");
    });

    it("merges partial payloads with the provided fallback", () => {
        const result = resolveScoringConfigPayload(
            { aiAssistWeight: 35 },
            {
                aiAssistWeight: 25,
                problemSolvingWeight: 15,
                experienceWeight: 40,
                codingWeight: 60,
            }
        );

        expect(result).toEqual({
            aiAssistWeight: 35,
            problemSolvingWeight: 15,
            experienceWeight: 40,
            codingWeight: 60,
        });
    });

    it("uses the default fallback when none is provided", () => {
        const result = resolveScoringConfigPayload({});

        expect(result).toEqual(DEFAULT_SCORING_CONFIG);
    });
});
