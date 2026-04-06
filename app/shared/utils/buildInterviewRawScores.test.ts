import { describe, expect, it } from "vitest";
import { buildInterviewRawScores } from "./buildInterviewRawScores";

describe("buildInterviewRawScores", () => {
    it("preserves zero-weight categories from job definitions", () => {
        const result = buildInterviewRawScores(
            {
                experienceCategories: [
                    { name: "Enabled", weight: 2 },
                    { name: "Disabled", weight: 0 },
                ],
                codingCategories: [
                    { name: "Algorithms", weight: 3 },
                    { name: "Debugging", weight: 0 },
                ],
            },
            {
                experienceCategories: {
                    Enabled: { score: 90 },
                    Disabled: { score: 100 },
                },
            },
            {
                jobSpecificCategories: {
                    Algorithms: { score: 80 },
                    Debugging: { score: 100 },
                },
            }
        );

        expect(result.experienceScores).toEqual([
            { name: "Enabled", score: 90, weight: 2 },
            { name: "Disabled", score: 100, weight: 0 },
        ]);
        expect(result.categoryScores).toEqual([
            { name: "Algorithms", score: 80, weight: 3 },
            { name: "Debugging", score: 100, weight: 0 },
        ]);
    });
});
