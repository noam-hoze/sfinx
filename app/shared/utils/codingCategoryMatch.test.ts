import { describe, it, expect } from "vitest";
import { findCategoryKeyByName } from "./codingCategoryMatch";

describe("findCategoryKeyByName", () => {
    it("matches exact category names directly", () => {
        const categories = {
            "TypeScript Proficiency": { score: 82 },
        };
        expect(findCategoryKeyByName(categories, "TypeScript Proficiency")).toBe("TypeScript Proficiency");
    });

    it("matches when stored key omits parenthetical suffix", () => {
        const categories = {
            "Python Proficiency": { score: 91 },
        };
        expect(findCategoryKeyByName(categories, "Python Proficiency (5+ years hands-on)")).toBe("Python Proficiency");
    });

    it("matches when stored key keeps parenthetical suffix", () => {
        const categories = {
            "Software Development Experience (7+ years)": { score: 76 },
        };
        expect(findCategoryKeyByName(categories, "Software Development Experience")).toBe(
            "Software Development Experience (7+ years)"
        );
    });

    it("does not match partial prefixes to sibling categories", () => {
        const categories = {
            JavaScript: { score: 90 },
            "React Native": { score: 88 },
            "C++": { score: 84 },
        };
        expect(findCategoryKeyByName(categories, "Java")).toBeNull();
        expect(findCategoryKeyByName(categories, "React")).toBeNull();
        expect(findCategoryKeyByName(categories, "C")).toBeNull();
    });

    it("returns null when no match exists", () => {
        const categories = {
            "System Design": { score: 65 },
        };
        expect(findCategoryKeyByName(categories, "Data Structures")).toBeNull();
    });
});
