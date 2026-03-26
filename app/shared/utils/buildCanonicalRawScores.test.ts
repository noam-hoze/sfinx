import { describe, expect, it } from "vitest";
import { buildCanonicalRawScores } from "./buildCanonicalRawScores";

describe("buildCanonicalRawScores", () => {
    it("preserves explicit zero weights and includes missing configured categories", () => {
        const result = buildCanonicalRawScores({
            experienceCategoryDefinitions: [
                { name: "Architecture", weight: 0 },
                { name: "Leadership", weight: 2 },
            ],
            experienceCategoryScores: {
                Leadership: { score: 80 },
            },
            codingCategoryDefinitions: [
                { name: "Algorithms", weight: 0 },
                { name: "Testing", weight: 3 },
            ],
            codingCategoryScores: {
                Testing: { score: 70 },
            },
        });

        expect(result.experienceScores).toEqual([
            { name: "Architecture", score: 0, weight: 0 },
            { name: "Leadership", score: 80, weight: 2 },
        ]);
        expect(result.categoryScores).toEqual([
            { name: "Algorithms", score: 0, weight: 0 },
            { name: "Testing", score: 70, weight: 3 },
        ]);
    });
});
