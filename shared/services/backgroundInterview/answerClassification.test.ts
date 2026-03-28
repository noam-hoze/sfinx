import { describe, expect, it } from "vitest";
import { isSubstantiveQuestionTurn } from "./answerClassification";

/**
 * Guards against API-shape drift between next-question route and handler.
 */
describe("isSubstantiveQuestionTurn", () => {
    it("uses detectedAnswerType when present", () => {
        expect(isSubstantiveQuestionTurn({ detectedAnswerType: "substantive" })).toBe(true);
        expect(isSubstantiveQuestionTurn({ detectedAnswerType: "dont_know" })).toBe(false);
        expect(isSubstantiveQuestionTurn({ detectedAnswerType: "clarification_request" })).toBe(false);
    });

    it("falls back to legacy boolean flags", () => {
        expect(
            isSubstantiveQuestionTurn({
                isClarificationRequest: false,
                isDontKnow: false,
            })
        ).toBe(true);
        expect(
            isSubstantiveQuestionTurn({
                isClarificationRequest: true,
                isDontKnow: false,
            })
        ).toBe(false);
    });

    it("defaults to non-substantive when classification is missing", () => {
        expect(isSubstantiveQuestionTurn({})).toBe(false);
    });
});
