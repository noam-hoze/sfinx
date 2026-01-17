/**
 * Unit tests for background summary prompt validation.
 */
import { describe, expect, it } from "vitest";
import { buildBackgroundSummaryPrompt } from "./backgroundSummaryPrompt";

/**
 * Build a minimal summary input.
 */
function buildInput(overrides: Partial<Parameters<typeof buildBackgroundSummaryPrompt>[0]> = {}) {
    return {
        messages: [{ speaker: "ai", text: "Question?", timestamp: 1 }],
        experienceCategories: [{ name: "Leadership", description: "Leads", weight: 1 }],
        companyName: "Acme",
        roleName: "Engineer",
        ...overrides,
    };
}

describe("buildBackgroundSummaryPrompt", () => {
    it("throws when companyName is missing", () => {
        const input = buildInput({ companyName: "" });
        expect(() => buildBackgroundSummaryPrompt(input)).toThrow("companyName is required");
    });

    it("throws when scores are missing for categories", () => {
        const input = buildInput({ scores: {} });
        expect(() => buildBackgroundSummaryPrompt(input)).toThrow("Score is required for Leadership");
    });

    it("throws when rationales are missing for categories", () => {
        const input = buildInput({ rationales: {} });
        expect(() => buildBackgroundSummaryPrompt(input)).toThrow("Rationale for Leadership is required");
    });
});
