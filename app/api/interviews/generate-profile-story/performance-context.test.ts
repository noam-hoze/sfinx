import { describe, expect, it } from "vitest";

describe("calculatePerformanceContext", () => {
    it("defaults missing problemSolvingWeight to avoid NaN scores", async () => {
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
                    Algorithms: { score: 60, weight: 1 },
                },
            },
            [],
            {
                scoringConfiguration: {
                    aiAssistWeight: 25,
                    experienceWeight: 50,
                    codingWeight: 50,
                },
            }
        );

        expect(Number.isFinite(result.finalScore)).toBe(true);
        expect(result.finalScore).toBe(55);
        expect(result.performanceLevel).toBe("competent");
    });
});
