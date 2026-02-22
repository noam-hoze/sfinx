/**
 * Unit tests for answer classification utilities.
 *
 * These functions control the interview flow: gibberish detection determines
 * whether to ask for clarification, "I don't know" detection triggers topic
 * exclusion, and the retry/threshold logic decides when to move on.
 */

import { describe, it, expect } from "vitest";
import {
    isGibberishAnswer,
    isExactDontKnow,
    shouldIncrementRetryCounter,
    shouldMoveToNextQuestion,
    buildClassificationPrompt,
} from "./answerClassification";

// ---------------------------------------------------------------------------
// isGibberishAnswer
// ---------------------------------------------------------------------------

describe("isGibberishAnswer", () => {
    it("returns true for empty string", () => {
        expect(isGibberishAnswer("")).toBe(true);
    });

    it("returns true for single character", () => {
        expect(isGibberishAnswer("a")).toBe(true);
    });

    it("returns true for two characters", () => {
        expect(isGibberishAnswer("ab")).toBe(true);
    });

    it("returns true for repeating single character", () => {
        expect(isGibberishAnswer("aaa")).toBe(true);
        expect(isGibberishAnswer("xxxxx")).toBe(true);
    });

    it("returns true for only special characters / numbers (no alpha)", () => {
        expect(isGibberishAnswer("123")).toBe(true);
        expect(isGibberishAnswer("!@#$%")).toBe(true);
        expect(isGibberishAnswer("456789")).toBe(true);
    });

    it("returns true for repeated 2-4 char patterns", () => {
        expect(isGibberishAnswer("asdf asdf asdf")).toBe(true);
        expect(isGibberishAnswer("blah blah blah")).toBe(true);
        expect(isGibberishAnswer("ha ha ha")).toBe(true);
    });

    it("returns true for keyboard mashing (5+ consonants, under 15 chars)", () => {
        expect(isGibberishAnswer("bcdfghjk")).toBe(true);
        expect(isGibberishAnswer("qwrtplkjh")).toBe(true);
    });

    it("returns false for legitimate short answers", () => {
        expect(isGibberishAnswer("yes")).toBe(false);
        expect(isGibberishAnswer("I used React hooks")).toBe(false);
        expect(isGibberishAnswer("No experience")).toBe(false);
    });

    it("returns false for 'I don't know' (not gibberish)", () => {
        expect(isGibberishAnswer("I don't know")).toBe(false);
    });

    it("returns false for longer text even with consonant clusters", () => {
        // Length >= 15 bypasses the consonant cluster check
        expect(isGibberishAnswer("I worked with strengths and algorithms daily")).toBe(false);
    });

    it("returns true for whitespace-only input (trimmed length < 3)", () => {
        expect(isGibberishAnswer("   ")).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// isExactDontKnow
// ---------------------------------------------------------------------------

describe("isExactDontKnow", () => {
    it("returns true for exact 'i don't know' (lowercase)", () => {
        expect(isExactDontKnow("i don't know")).toBe(true);
    });

    it("returns true for 'I don't know' (capitalized)", () => {
        expect(isExactDontKnow("I don't know")).toBe(true);
    });

    it("returns true with leading/trailing whitespace", () => {
        expect(isExactDontKnow("  I don't know  ")).toBe(true);
    });

    it("returns false for extended sentence", () => {
        expect(isExactDontKnow("I don't know much about that")).toBe(false);
    });

    it("returns false for abbreviation 'idk'", () => {
        expect(isExactDontKnow("idk")).toBe(false);
    });

    it("returns false for empty string", () => {
        expect(isExactDontKnow("")).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// shouldIncrementRetryCounter
// ---------------------------------------------------------------------------

describe("shouldIncrementRetryCounter", () => {
    it("returns true for clarification_request under threshold", () => {
        // threshold=3, retryCount=0 -> 0 < 3-1=2 -> true
        expect(shouldIncrementRetryCounter("clarification_request", 0, 3)).toBe(true);
        expect(shouldIncrementRetryCounter("clarification_request", 1, 3)).toBe(true);
    });

    it("returns false for clarification_request at threshold - 1", () => {
        // threshold=3, retryCount=2 -> 2 < 2 -> false
        expect(shouldIncrementRetryCounter("clarification_request", 2, 3)).toBe(false);
    });

    it("returns false for dont_know regardless of count", () => {
        expect(shouldIncrementRetryCounter("dont_know", 0, 3)).toBe(false);
        expect(shouldIncrementRetryCounter("dont_know", 1, 3)).toBe(false);
    });

    it("returns false for substantive regardless of count", () => {
        expect(shouldIncrementRetryCounter("substantive", 0, 3)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// shouldMoveToNextQuestion
// ---------------------------------------------------------------------------

describe("shouldMoveToNextQuestion", () => {
    it("returns true for clarification_request at threshold - 1", () => {
        // threshold=3, retryCount=2 -> 2 >= 2 -> true
        expect(shouldMoveToNextQuestion("clarification_request", 2, 3)).toBe(true);
    });

    it("returns true for clarification_request above threshold", () => {
        expect(shouldMoveToNextQuestion("clarification_request", 5, 3)).toBe(true);
    });

    it("returns false for clarification_request under threshold", () => {
        expect(shouldMoveToNextQuestion("clarification_request", 0, 3)).toBe(false);
        expect(shouldMoveToNextQuestion("clarification_request", 1, 3)).toBe(false);
    });

    it("returns false for dont_know regardless of count", () => {
        expect(shouldMoveToNextQuestion("dont_know", 5, 3)).toBe(false);
    });

    it("returns false for substantive regardless of count", () => {
        expect(shouldMoveToNextQuestion("substantive", 5, 3)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// buildClassificationPrompt
// ---------------------------------------------------------------------------

describe("buildClassificationPrompt", () => {
    const baseParams = {
        lastQuestion: "Tell me about your experience with React",
        lastAnswer: "I built several apps",
        categoryList: "- React: Frontend framework\n- Node.js: Backend runtime",
        newFocusTopic: "Node.js",
        clarificationRetryCount: 0,
        clarificationThreshold: 3,
        isGibberish: false,
    };

    it("includes lastQuestion and lastAnswer in output", () => {
        const result = buildClassificationPrompt(baseParams);
        expect(result).toContain("Tell me about your experience with React");
        expect(result).toContain("I built several apps");
    });

    it("includes category list in output", () => {
        const result = buildClassificationPrompt(baseParams);
        expect(result).toContain("- React: Frontend framework");
        expect(result).toContain("- Node.js: Backend runtime");
    });

    it("includes JSON return format instruction", () => {
        const result = buildClassificationPrompt(baseParams);
        expect(result).toContain("detectedAnswerType");
        expect(result).toContain("question");
    });

    it("includes ANSWER CLASSIFICATION section for normal (non-gibberish) answers", () => {
        const result = buildClassificationPrompt(baseParams);
        expect(result).toContain("ANSWER CLASSIFICATION");
    });

    it("includes GIBBERISH HANDLING with dont_know when gibberish at threshold", () => {
        const result = buildClassificationPrompt({
            ...baseParams,
            isGibberish: true,
            clarificationRetryCount: 2,  // at threshold-1 (3-1=2)
            clarificationThreshold: 3,
        });
        expect(result).toContain("GIBBERISH HANDLING");
        expect(result).toContain("dont_know");
        expect(result).not.toContain("ANSWER CLASSIFICATION");
    });

    it("includes GIBBERISH HANDLING with clarification_request when gibberish under threshold", () => {
        const result = buildClassificationPrompt({
            ...baseParams,
            isGibberish: true,
            clarificationRetryCount: 0,
            clarificationThreshold: 3,
        });
        expect(result).toContain("GIBBERISH HANDLING");
        expect(result).toContain("clarification_request");
        expect(result).not.toContain("ANSWER CLASSIFICATION");
    });

    it("includes RETRY CONTEXT when retryCount > 0 in normal mode", () => {
        const result = buildClassificationPrompt({
            ...baseParams,
            clarificationRetryCount: 1,
        });
        expect(result).toContain("RETRY CONTEXT");
    });

    it("does not include RETRY CONTEXT when retryCount is 0", () => {
        const result = buildClassificationPrompt(baseParams);
        expect(result).not.toContain("RETRY CONTEXT");
    });
});
