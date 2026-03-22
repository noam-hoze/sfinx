/**
 * Unit tests for POST /api/interviews/evaluate-paste-accountability.
 * Verifies the API validates and returns answer-intent classification.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({
    createMock: vi.fn(),
}));

vi.mock("openai", () => ({
    default: vi.fn().mockImplementation(() => ({
        chat: { completions: { create: createMock } },
    })),
}));

vi.mock("app/shared/services", () => ({
    log: { info: vi.fn(), error: vi.fn() },
}));

vi.mock("app/shared/services/logger.config", () => ({
    LOG_CATEGORIES: { INTERVIEWS: "INTERVIEWS" },
}));

import { POST } from "./route";

const requestBody = {
    pastedContent: "const count = items.length;",
    question: "What is this line doing?",
    answer: "It counts the items in the array.",
};

/** Creates a minimal NextRequest-like object for the route. */
function makeRequest(body: unknown) {
    return { json: async () => body } as any;
}

/** Mocks an OpenAI paste-accountability response. */
function mockCompletion(content: Record<string, unknown>) {
    createMock.mockResolvedValue({
        choices: [{
            message: {
                content: JSON.stringify(content),
            },
        }],
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_MAX_PASTE_QUESTIONS = "3";
});

describe("POST /api/interviews/evaluate-paste-accountability", () => {
    it("returns detectedAnswerType when OpenAI provides it", async () => {
        mockCompletion({
            detectedAnswerType: "clarification_request",
            score: 0,
            reasoning: "The candidate asked what the line means.",
            understandingLevel: "none",
        });

        const response = await POST(makeRequest(requestBody));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.detectedAnswerType).toBe("clarification_request");
    });

    it("rejects responses that omit detectedAnswerType", async () => {
        mockCompletion({
            score: 25,
            reasoning: "Missing the required intent classification.",
            understandingLevel: "partial",
        });

        const response = await POST(makeRequest(requestBody));
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.details).toContain("Invalid response structure from OpenAI");
    });

    it("rejects invalid score ranges", async () => {
        mockCompletion({
            detectedAnswerType: "substantive",
            score: 101,
            reasoning: "Out-of-range scores should fail validation.",
            understandingLevel: "partial",
        });

        const response = await POST(makeRequest(requestBody));
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.details).toContain("Invalid response structure from OpenAI");
    });

    it("rejects non-substantive responses with non-zero scores", async () => {
        mockCompletion({
            detectedAnswerType: "dont_know",
            score: 15,
            reasoning: "Non-substantive answers must not score above zero.",
            understandingLevel: "none",
        });

        const response = await POST(makeRequest(requestBody));
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.details).toContain("Invalid response structure from OpenAI");
    });

    it("rejects malformed topic coverage updates", async () => {
        mockCompletion({
            detectedAnswerType: "substantive",
            score: 70,
            reasoning: "The answer partially covered parsing concerns.",
            understandingLevel: "partial",
            topicsAddressed: ["Unknown Topic"],
        });

        const response = await POST(makeRequest({
            ...requestBody,
            currentTopicCoverage: { Parsing: 0 },
        }));
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.details).toContain("Invalid response structure: missing topicsAddressed");
    });
});
