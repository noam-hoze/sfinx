import { describe, expect, it } from "vitest";
import { resolveCategoryKeyByName } from "./resolveCategoryByName";

describe("resolveCategoryKeyByName", () => {
    it("returns exact match when present", () => {
        const categories = { "TypeScript Proficiency": { score: 90 } };
        const key = resolveCategoryKeyByName(categories, "TypeScript Proficiency");
        expect(key).toBe("TypeScript Proficiency");
    });

    it("matches by normalized casing and spacing", () => {
        const categories = { "System   Design": { score: 85 } };
        const key = resolveCategoryKeyByName(categories, " system design ");
        expect(key).toBe("System   Design");
    });

    it("matches parenthetical/base-name variants", () => {
        const categories = { "Problem Solving (Correctness)": { score: 88 } };
        const key = resolveCategoryKeyByName(categories, "Problem Solving");
        expect(key).toBe("Problem Solving (Correctness)");
    });

    it("matches prefix-compatible semantic variants", () => {
        const categories = { "TypeScript": { score: 91 } };
        const key = resolveCategoryKeyByName(categories, "TypeScript Proficiency");
        expect(key).toBe("TypeScript");
    });

    it("returns null when no plausible match exists", () => {
        const categories = { Testing: { score: 70 } };
        const key = resolveCategoryKeyByName(categories, "System Design");
        expect(key).toBeNull();
    });
});
