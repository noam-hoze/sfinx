import { describe, expect, it } from "vitest";

describe("calculatePerformanceContext", () => {
    it("uses default problemSolvingWeight when missing and avoids NaN scores", async () => {
        process.env.OPENAI_API_KEY = "test-key";
        const { calculatePerformanceContext } = await import("./route");

        const context = calculatePerformanceContext(
            { experienceCategories: { deep_learning: { score: 80, weight: 1 } } },
            { jobSpecificCategories: { python: { score: 80, weight: 1 } } },
            [],
            {
                scoringConfiguration: {
                    aiAssistWeight: 25,
                    experienceWeight: 50,
                    codingWeight: 50,
                },
            },
            100
        );

        expect(Number.isFinite(context.finalScore)).toBe(true);
        expect(context.finalScore).toBe(73);
        expect(context.performanceLevel).toBe("strong");
    });
});
