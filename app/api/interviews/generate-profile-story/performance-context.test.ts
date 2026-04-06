import { describe, expect, it } from "vitest";
import { calculateScore } from "app/shared/utils/calculateScore";

describe("calculatePerformanceContext", () => {
    it("returns a finite score when problemSolvingWeight is missing", async () => {
        process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "test-key";
        const { calculatePerformanceContext } = await import("./route");
        const job = {
            experienceCategories: [{ name: "System Design", weight: 1 }],
            codingCategories: [{ name: "Algorithms", weight: 1 }],
            scoringConfiguration: {
                aiAssistWeight: 25,
                experienceWeight: 50,
                codingWeight: 50,
            },
        };

        const result = calculatePerformanceContext(
            {
                experienceCategories: {
                    "System Design": { score: 80, weight: 1 },
                },
            },
            {
                jobSpecificCategories: {
                    Algorithms: { score: 60, weight: 1 },
                },
            },
            [],
            job
        );

        expect(Number.isFinite(result.finalScore)).toBe(true);
        expect(result.finalScore).toBe(63);
        expect(result.performanceLevel).toBe("competent");
    });

    it("includes persisted problemSolvingScore in profile-story scoring", async () => {
        process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "test-key";
        const { calculatePerformanceContext } = await import("./route");
        const backgroundSummary = {
            experienceCategories: {
                "System Design": { score: 80, weight: 1 },
            },
        };
        const codingSummary = {
            jobSpecificCategories: {
                Algorithms: { score: 80, weight: 1 },
            },
        };
        const scoringConfiguration = {
            aiAssistWeight: 25,
            problemSolvingWeight: 25,
            experienceWeight: 50,
            codingWeight: 50,
        };
        const job = {
            experienceCategories: [{ name: "System Design", weight: 1 }],
            codingCategories: [{ name: "Algorithms", weight: 1 }],
            scoringConfiguration,
        };
        const result = calculatePerformanceContext(
            backgroundSummary,
            codingSummary,
            [{ accountabilityScore: 60, understanding: "strong" }],
            job,
            { problemSolvingScore: 100 }
        );
        const expected = calculateScore(
            {
                experienceScores: [{ name: "System Design", score: 80, weight: 1 }],
                categoryScores: [{ name: "Algorithms", score: 80, weight: 1 }],
            },
            { aiAssistAccountabilityScore: 60, problemSolvingScore: 100 },
            scoringConfiguration
        );

        expect(result.experienceScore).toBe(expected.experienceScore);
        expect(result.codingScore).toBe(expected.codingScore);
        expect(result.finalScore).toBe(expected.finalScore);
    });

    it("uses job category definitions so missing categories stay zero-weighted canonically", async () => {
        process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "test-key";
        const { calculatePerformanceContext } = await import("./route");
        const result = calculatePerformanceContext(
            {
                experienceCategories: {
                    "System Design": { score: 80, weight: 1 },
                },
            },
            {
                jobSpecificCategories: {
                    Algorithms: { score: 80, weight: 1 },
                },
            },
            [],
            {
                experienceCategories: [
                    { name: "System Design", weight: 3 },
                    { name: "Communication", weight: 1 },
                ],
                codingCategories: [
                    { name: "Algorithms", weight: 3 },
                    { name: "Debugging", weight: 1 },
                ],
                scoringConfiguration: {
                    aiAssistWeight: 0,
                    problemSolvingWeight: 0,
                    experienceWeight: 50,
                    codingWeight: 50,
                },
            }
        );

        expect(result.experienceScore).toBe(60);
        expect(result.codingScore).toBe(60);
        expect(result.finalScore).toBe(60);
    });
});
