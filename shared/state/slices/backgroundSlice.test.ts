/**
 * Unit tests for background slice validation.
 */
import { describe, expect, it } from "vitest";
import backgroundReducer, { forceTimeExpiry, updateCategoryStats } from "./backgroundSlice";

/**
 * Build a base background state.
 */
function buildState(overrides: Partial<Parameters<typeof backgroundReducer>[0]> = {}) {
    return {
        messages: [],
        transitioned: false,
        evaluatingAnswer: false,
        currentFocusTopic: null,
        currentQuestionTarget: null,
        categoryStats: [],
        ...overrides,
    };
}

describe("backgroundSlice", () => {
    it("throws when forcing expiry without timebox", () => {
        const state = buildState();
        expect(() => backgroundReducer(state as any, forceTimeExpiry())).toThrow("timeboxMs is required.");
    });

    it("throws when updating unknown category stats", () => {
        const state = buildState({
            categoryStats: [{ categoryName: "Leadership", count: 1, avgStrength: 10, dontKnowCount: 0 }],
        });
        const action = updateCategoryStats({ stats: [{ categoryName: "Missing", count: 0, avgStrength: 0, dontKnowCount: 0 }] });
        expect(() => backgroundReducer(state as any, action)).toThrow("Missing category stats for Missing");
    });
});
