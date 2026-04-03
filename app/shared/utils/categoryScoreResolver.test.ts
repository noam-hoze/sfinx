import { describe, expect, it } from "vitest";
import { resolveCategoryKey, resolveCategoryScore } from "./categoryScoreResolver";

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

    it("does not cross-match sibling categories by prefix", () => {
        const categories = {
            "React Native": { score: 77 },
        };

        const score = resolveCategoryScore(categories, "React");
        expect(score).toBe(0);
    });
});

describe("resolveCategoryKey", () => {
    it("returns the stored key for a unique normalized match", () => {
        const categories = {
            "Python Proficiency": { score: 91 },
        };

        const key = resolveCategoryKey(categories, "Python Proficiency (5+ years hands-on)");
        expect(key).toBe("Python Proficiency");
    });

    it("returns undefined when normalized matches are ambiguous", () => {
        const categories = {
            "Python Proficiency": { score: 91 },
            " python proficiency ": { score: 75 },
        };

        const key = resolveCategoryKey(categories, "Python Proficiency (5+ years hands-on)");
        expect(key).toBeUndefined();
    });
});
