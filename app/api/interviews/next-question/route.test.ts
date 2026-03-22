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
function mockCompletion() {
    createMock.mockResolvedValue({
        choices: [{
            finish_reason: "stop",
            message: {
                content: JSON.stringify({
                    detectedAnswerType: "substantive",
                    question: "What specifically ruled out a write-through cache here?",
                    probeAngle: "tradeoff",
                    fingerprint: {
                        topic: "Distributed Systems",
                        angle: "tradeoff",
                        slot: "tradeoff_choice",
                    },
                }),
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
        mockCompletion();

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
});
