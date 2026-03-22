/**
 * Unit tests for POST /api/interviews/next-question.
 * Verifies the API returns OpenAI's answer classification to the client.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock, findUniqueMock } = vi.hoisted(() => ({
    createMock: vi.fn(),
    findUniqueMock: vi.fn(),
}));

vi.mock("openai", () => ({
    default: vi.fn().mockImplementation(() => ({
        chat: { completions: { create: createMock } },
    })),
}));

vi.mock("lib/prisma", () => ({
    default: { interviewSession: { findUnique: findUniqueMock } },
}));

vi.mock("app/shared/services", () => ({
    log: { info: vi.fn(), error: vi.fn() },
}));

vi.mock("app/shared/services/logger.config", () => ({
    LOG_CATEGORIES: { INTERVIEWS: "INTERVIEWS" },
}));

import { POST } from "./route";

const requestBody = {
    sessionId: "session-1",
    lastQuestion: "Tell me about the cache.",
    lastAnswer: "We used Redis with a 50ms latency goal.",
    experienceCategories: [{ name: "Distributed Systems" }],
    currentCounts: [
        { categoryName: "Distributed Systems", count: 1, avgStrength: 70, dontKnowCount: 0 },
    ],
    currentFocusTopic: "Distributed Systems",
    excludedTopics: [],
    clarificationRetryCount: 0,
    recentHistory: [],
    coveredAngles: [],
    allPreviousProbes: [],
};

/** Creates a minimal NextRequest-like object for the route. */
function makeRequest(body: unknown) {
    return { json: async () => body } as any;
}

/** Mocks the interview session lookup used to build the system prompt. */
function mockSessionLookup() {
    findUniqueMock.mockResolvedValue({
        application: { job: { title: "Backend Engineer", company: { name: "Sfinx" } } },
    });
}

/** Mocks an OpenAI classified question response. */
function mockCompletion(content: Record<string, unknown>) {
    createMock.mockResolvedValue({
        choices: [{
            finish_reason: "stop",
            message: {
                content: JSON.stringify(content),
            },
        }],
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_USE_SPLIT_EVALUATION = "true";
    process.env.NEXT_PUBLIC_OPENAI_EVALUATION_MODEL = "gpt-4.1-mini";
    process.env.NEXT_PUBLIC_DONT_KNOW_THRESHOLD = "2";
    process.env.NEXT_PUBLIC_CLARIFICATION_THRESHOLD = "3";
});

describe("POST /api/interviews/next-question", () => {
    it("returns detectedAnswerType for substantive probe tracking", async () => {
        mockSessionLookup();
        mockCompletion({
            detectedAnswerType: "substantive",
            question: "What specifically ruled out a write-through cache here?",
            probeAngle: "tradeoff",
            fingerprint: {
                topic: "Distributed Systems",
                angle: "tradeoff",
                slot: "tradeoff_choice",
            },
        });

        const response = await POST(makeRequest(requestBody));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.detectedAnswerType).toBe("substantive");
        expect(body.question).toBe("What specifically ruled out a write-through cache here?");
        expect(body.fingerprint).toEqual({
            topic: "Distributed Systems",
            angle: "tradeoff",
            slot: "tradeoff_choice",
        });
    });

    it("keeps the current focus topic for clarification retries", async () => {
        mockSessionLookup();
        mockCompletion({
            detectedAnswerType: "clarification_request",
            question: "Can you walk me through how that cache worked in practice?",
        });

        const response = await POST(makeRequest({
            ...requestBody,
            currentFocusTopic: "Algorithms",
            experienceCategories: [{ name: "Algorithms" }, { name: "Distributed Systems" }],
            currentCounts: [
                { categoryName: "Algorithms", count: 0, avgStrength: 20, dontKnowCount: 0 },
                { categoryName: "Distributed Systems", count: 2, avgStrength: 90, dontKnowCount: 0 },
            ],
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.detectedAnswerType).toBe("clarification_request");
        expect(body.newFocusTopic).toBe("Algorithms");
        expect(body.probeAngle).toBeNull();
        expect(body.fingerprint).toBeNull();
        expect(body.shouldIncrementRetry).toBe(true);
    });

    it("advances to the next focus topic after an explicit skip", async () => {
        mockSessionLookup();
        mockCompletion({
            detectedAnswerType: "dont_know",
            question: "No problem. Let's talk about Distributed Systems instead.",
        });

        const response = await POST(makeRequest({
            ...requestBody,
            currentFocusTopic: "Algorithms",
            experienceCategories: [{ name: "Algorithms" }, { name: "Distributed Systems" }],
            currentCounts: [
                { categoryName: "Algorithms", count: 0, avgStrength: 20, dontKnowCount: 0 },
                { categoryName: "Distributed Systems", count: 2, avgStrength: 90, dontKnowCount: 0 },
            ],
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.detectedAnswerType).toBe("dont_know");
        expect(body.newFocusTopic).toBe("Distributed Systems");
        expect(body.shouldMoveOn).toBe(false);
    });

    it("does not exclude the only topic before OpenAI classifies a clarification request", async () => {
        mockSessionLookup();
        mockCompletion({
            detectedAnswerType: "clarification_request",
            question: "Sure — what part of the cache setup should I clarify?",
        });

        const response = await POST(makeRequest({
            ...requestBody,
            lastAnswer: "Not sure, can you clarify what you mean?",
            experienceCategories: [{ name: "Algorithms" }],
            currentCounts: [
                { categoryName: "Algorithms", count: 0, avgStrength: 20, dontKnowCount: 1 },
            ],
            currentFocusTopic: "Algorithms",
        }));
        const body = await response.json();

        expect(createMock).toHaveBeenCalledOnce();
        expect(response.status).toBe(200);
        expect(body.allCategoriesExcluded).toBeUndefined();
        expect(body.detectedAnswerType).toBe("clarification_request");
        expect(body.newFocusTopic).toBe("Algorithms");
    });

    it("uses angle history for the selected focus topic", async () => {
        mockSessionLookup();
        mockCompletion({
            detectedAnswerType: "substantive",
            question: "What tradeoff made Redis worth the extra complexity here?",
            probeAngle: "tradeoff",
            fingerprint: {
                topic: "Distributed Systems",
                angle: "tradeoff",
                slot: "tradeoff_choice",
            },
        });

        const response = await POST(makeRequest({
            ...requestBody,
            currentFocusTopic: "Algorithms",
            experienceCategories: [{ name: "Algorithms" }, { name: "Distributed Systems" }],
            currentCounts: [
                { categoryName: "Algorithms", count: 0, avgStrength: 20, dontKnowCount: 0 },
                { categoryName: "Distributed Systems", count: 2, avgStrength: 90, dontKnowCount: 0 },
            ],
            coveredAnglesByTopic: {
                Algorithms: ["implementation"],
                "Distributed Systems": ["tradeoff"],
            },
        }));
        const body = await response.json();
        const prompt = createMock.mock.calls[0][0].messages[1].content;

        expect(response.status).toBe(200);
        expect(body.newFocusTopic).toBe("Distributed Systems");
        expect(prompt).toContain("Angles already covered for this topic: tradeoff.");
    });

    it("regenerates the next question when a confirmed dont_know excludes the current topic", async () => {
        mockSessionLookup();
        createMock
            .mockResolvedValueOnce({
                choices: [{
                    finish_reason: "stop",
                    message: {
                        content: JSON.stringify({
                            detectedAnswerType: "dont_know",
                            question: "No problem. Let's stay on Algorithms for one more question.",
                        }),
                    },
                }],
            })
            .mockResolvedValueOnce({
                choices: [{
                    finish_reason: "stop",
                    message: {
                        content: JSON.stringify({
                            detectedAnswerType: "dont_know",
                            question: "No problem. Let's talk about Distributed Systems instead.",
                        }),
                    },
                }],
            });

        const response = await POST(makeRequest({
            ...requestBody,
            currentFocusTopic: "Algorithms",
            experienceCategories: [{ name: "Algorithms" }, { name: "Distributed Systems" }],
            currentCounts: [
                { categoryName: "Algorithms", count: 2, avgStrength: 90, dontKnowCount: 1 },
                { categoryName: "Distributed Systems", count: 1, avgStrength: 60, dontKnowCount: 0 },
            ],
        }));
        const body = await response.json();

        expect(createMock).toHaveBeenCalledTimes(2);
        expect(response.status).toBe(200);
        expect(body.detectedAnswerType).toBe("dont_know");
        expect(body.newFocusTopic).toBe("Distributed Systems");
        expect(body.question).toBe("No problem. Let's talk about Distributed Systems instead.");
    });

    it("rejects substantive responses without probe metadata", async () => {
        mockSessionLookup();
        mockCompletion({
            detectedAnswerType: "substantive",
            question: "What ruled out write-through?",
        });

        const response = await POST(makeRequest(requestBody));
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error).toContain("Substantive response missing probe metadata");
    });

    it("rejects substantive responses with malformed fingerprint slots", async () => {
        mockSessionLookup();
        mockCompletion({
            detectedAnswerType: "substantive",
            question: "What ruled out write-through?",
            probeAngle: "tradeoff",
            fingerprint: {
                topic: "Distributed Systems",
                angle: "tradeoff",
                slot: true,
            },
        });

        const response = await POST(makeRequest(requestBody));
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error).toContain("Substantive response has inconsistent probe metadata");
    });

    it("rejects non-substantive responses with probe metadata", async () => {
        mockSessionLookup();
        mockCompletion({
            detectedAnswerType: "clarification_request",
            question: "Let me rephrase that.",
            probeAngle: "tradeoff",
            fingerprint: {
                topic: "Distributed Systems",
                angle: "tradeoff",
                slot: "tradeoff_choice",
            },
        });

        const response = await POST(makeRequest(requestBody));
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error).toContain("Non-substantive response must not include probe metadata");
    });
});
