import { describe, expect, it } from "vitest";
import { resolveCategoryScore } from "./categoryScoreResolver";

describe("resolveCategoryScore", () => {
    it("returns exact category score when key matches", () => {
        const categories = {
            "Python Proficiency (5+ years hands-on)": { score: 88 },
        };

        const score = resolveCategoryScore(categories, "Python Proficiency (5+ years hands-on)");
        expect(score).toBe(88);
    });

    it("falls back to base-name matching when AI adds suffix text", () => {
        const categories = {
            "Python Proficiency": { score: 91 },
        };

        const score = resolveCategoryScore(categories, "Python Proficiency (5+ years hands-on)");
        expect(score).toBe(91);
    });

    it("returns 0 when no matching category exists", () => {
        const categories = {
            "React Best Practices": { score: 77 },
        };

        const score = resolveCategoryScore(categories, "TypeScript Proficiency");
        expect(score).toBe(0);
    });
});
