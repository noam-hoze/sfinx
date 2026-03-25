import { describe, expect, it } from "vitest";
import { findCategoryScoreKey } from "./categoryMatching";

describe("findCategoryScoreKey", () => {
    it("returns exact key match when present", () => {
        const keys = ["Algorithms", "Code Quality"];
        expect(findCategoryScoreKey("Algorithms", keys)).toBe("Algorithms");
    });

    it("matches legacy decorated category names", () => {
        const keys = ["Data Structures"];
        expect(findCategoryScoreKey("Data Structures (25%)", keys)).toBe("Data Structures");
    });

    it("matches keys that extend a base category name", () => {
        const keys = ["Concurrency (thread safety)"];
        expect(findCategoryScoreKey("Concurrency", keys)).toBe("Concurrency (thread safety)");
    });

    it("returns undefined when there is no semantic match", () => {
        const keys = ["System Design"];
        expect(findCategoryScoreKey("Algorithms", keys)).toBeUndefined();
    });
});
