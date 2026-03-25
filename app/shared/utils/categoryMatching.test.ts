import { describe, expect, it } from "vitest";
import { findCategoryScoreKey, normalizeCategoryName } from "./categoryMatching";

describe("findCategoryScoreKey", () => {
    it("returns exact key match when present", () => {
        const keys = ["Algorithms", "Code Quality"];
        expect(findCategoryScoreKey("Algorithms", keys)).toBe("Algorithms");
    });

    it("matches legacy decorated category names", () => {
        const keys = ["Data Structures"];
        expect(findCategoryScoreKey("Data Structures (25%)", keys)).toBe("Data Structures");
    });

    it("matches keys with decorated suffixes on either side", () => {
        const keys = ["Concurrency (thread safety)"];
        expect(findCategoryScoreKey("Concurrency", keys)).toBe("Concurrency (thread safety)");
    });

    it("returns undefined when there is no semantic match", () => {
        const keys = ["System Design"];
        expect(findCategoryScoreKey("Algorithms", keys)).toBeUndefined();
    });
});

describe("normalizeCategoryName", () => {
    it("removes trailing presentational suffixes", () => {
        expect(normalizeCategoryName("Data Structures (25%)")).toBe("Data Structures");
    });

    it("preserves names without trailing decorations", () => {
        expect(normalizeCategoryName("Algorithms")).toBe("Algorithms");
    });
});
