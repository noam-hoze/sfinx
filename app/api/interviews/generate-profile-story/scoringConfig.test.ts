import { describe, expect, it } from "vitest";

import { normalizeScoringConfig } from "./scoringConfig";

describe("normalizeScoringConfig", () => {
    it("applies defaults when configuration is missing", () => {
        const config = normalizeScoringConfig(undefined);

        expect(config.aiAssistWeight).toBe(25);
        expect(config.problemSolvingWeight).toBe(25);
        expect(config.experienceWeight).toBe(50);
        expect(config.codingWeight).toBe(50);
    });

    it("keeps existing values and backfills missing problemSolvingWeight", () => {
        const config = normalizeScoringConfig({
            aiAssistWeight: 30,
            experienceWeight: 40,
            codingWeight: 60,
        });

        expect(config.aiAssistWeight).toBe(30);
        expect(config.problemSolvingWeight).toBe(25);
        expect(config.experienceWeight).toBe(40);
        expect(config.codingWeight).toBe(60);
    });
});
