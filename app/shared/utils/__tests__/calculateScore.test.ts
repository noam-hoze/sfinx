/** Unit tests for calculateScore utility. */
import { describe, expect, it } from "vitest";
import { calculateScore } from "app/shared/utils/calculateScore";

const baseConfig = {
    aiAssistWeight: 1,
    experienceWeight: 1,
    codingWeight: 2,
};

const baseScores = {
    experienceScores: [
        { name: "projects", score: 80, weight: 2 },
        { name: "impact", score: 100, weight: 1 },
    ],
    categoryScores: [
        { name: "correctness", score: 70, weight: 1 },
        { name: "design", score: 90, weight: 3 },
    ],
};

describe("calculateScore", () => {
    it("computes weighted scores including AI assist contribution", () => {
        const result = calculateScore(
            baseScores,
            { aiAssistAccountabilityScore: 60 },
            baseConfig
        );

        expect(result).toEqual({
            finalScore: 82,
            experienceScore: 87,
            codingScore: 80,
            normalizedWorkstyle: { aiAssist: 60 },
        });
    });

    it("accounts for aiAssistWeight even when no AI assist score", () => {
        const result = calculateScore(
            {
                experienceScores: [{ name: "projects", score: 50, weight: 0 }],
                categoryScores: [{ name: "correctness", score: 100, weight: 2 }],
            },
            {},
            { ...baseConfig, experienceWeight: 0, codingWeight: 1 }
        );

        expect(result).toEqual({
            finalScore: 67,
            experienceScore: 0,
            codingScore: 67,
            normalizedWorkstyle: { aiAssist: null },
        });
    });
});
