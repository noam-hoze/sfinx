/**
 * Unit tests for paste summary generation logic.
 *
 * Tests the request validation and Q&A history formatting used by the
 * generate-paste-summary route to build the OpenAI prompt.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Replicated from generate-paste-summary/route.ts (lines 14-17)
// ---------------------------------------------------------------------------

interface PasteSummaryRequest {
    pastedContent?: string;
    questionAnswers?: Array<{ question: string; answer: string; score: number; reasoning?: string }>;
    averageScore?: unknown;
}

function validatePasteSummaryRequest(body: PasteSummaryRequest): { valid: boolean; error?: string } {
    if (!body.pastedContent || !body.questionAnswers || typeof body.averageScore !== "number") {
        return { valid: false, error: "Missing required fields: pastedContent, questionAnswers, averageScore" };
    }
    return { valid: true };
}

// ---------------------------------------------------------------------------
// Replicated from generate-paste-summary/route.ts (lines 27-31)
// ---------------------------------------------------------------------------

function buildQAHistory(
    questionAnswers: Array<{ question: string; answer: string; score: number; reasoning?: string }>,
): string {
    return questionAnswers
        .map((qa, idx) =>
            `Q${idx + 1} (score: ${qa.score}): ${qa.question}\nA${idx + 1}: ${qa.answer}\nReasoning: ${qa.reasoning}`
        )
        .join("\n\n");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("paste summary logic", () => {
    describe("validatePasteSummaryRequest", () => {
        it("returns error when pastedContent is missing", () => {
            expect(validatePasteSummaryRequest({
                questionAnswers: [],
                averageScore: 50,
            }).valid).toBe(false);
        });

        it("returns error when questionAnswers is missing", () => {
            expect(validatePasteSummaryRequest({
                pastedContent: "code",
                averageScore: 50,
            }).valid).toBe(false);
        });

        it("returns error when averageScore is not a number", () => {
            expect(validatePasteSummaryRequest({
                pastedContent: "code",
                questionAnswers: [],
                averageScore: "fifty",
            }).valid).toBe(false);
        });

        it("accepts averageScore of 0 (valid number)", () => {
            expect(validatePasteSummaryRequest({
                pastedContent: "code",
                questionAnswers: [],
                averageScore: 0,
            }).valid).toBe(true);
        });

        it("passes when all fields present", () => {
            expect(validatePasteSummaryRequest({
                pastedContent: "code",
                questionAnswers: [{ question: "Q?", answer: "A", score: 80 }],
                averageScore: 80,
            }).valid).toBe(true);
        });
    });

    describe("buildQAHistory", () => {
        it("formats single Q&A with score and reasoning", () => {
            const result = buildQAHistory([
                { question: "What does useState do?", answer: "It manages state", score: 75, reasoning: "Correct basics" },
            ]);
            expect(result).toContain("Q1 (score: 75): What does useState do?");
            expect(result).toContain("A1: It manages state");
            expect(result).toContain("Reasoning: Correct basics");
        });

        it("formats multiple Q&As with sequential numbering", () => {
            const result = buildQAHistory([
                { question: "Q1?", answer: "A1", score: 80, reasoning: "Good" },
                { question: "Q2?", answer: "A2", score: 40, reasoning: "Weak" },
            ]);
            expect(result).toContain("Q1 (score: 80)");
            expect(result).toContain("Q2 (score: 40)");
            expect(result).toContain("A2: A2");
        });

        it("returns empty string for empty array", () => {
            expect(buildQAHistory([])).toBe("");
        });
    });
});
