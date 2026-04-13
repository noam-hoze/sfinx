/**
 * Regression tests for POST /api/interviews/session/[sessionId]/process.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    after: vi.fn(),
    getServerSession: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
}));

vi.mock("next/server", async () => {
    const actual = await vi.importActual<typeof import("next/server")>("next/server");
    return { ...actual, after: mocks.after };
});

vi.mock("next-auth/next", () => ({
    getServerSession: mocks.getServerSession,
}));

vi.mock("app/shared/services/auth", () => ({
    authOptions: {},
}));

vi.mock("app/shared/services", () => ({
    log: {
        info: mocks.logInfo,
        warn: mocks.logWarn,
        error: mocks.logError,
    },
}));

vi.mock("app/shared/services/logger.config", () => ({
    LOG_CATEGORIES: {
        INTERVIEWS: "INTERVIEWS",
    },
}));

vi.mock("lib/prisma", () => ({
    default: {
        interviewSession: {
            findFirst: mocks.findFirst,
            updateMany: mocks.updateMany,
            update: mocks.update,
        },
    },
}));

import { POST } from "./route";

const routeContext = {
    params: Promise.resolve({ sessionId: "session-1" }),
};

/** Creates the minimal NextRequest shape needed by the route. */
function makeRequest(body: unknown, query = "") {
    const url = `https://example.com/api/interviews/session/session-1/process${query}`;
    return {
        url,
        nextUrl: new URL(url),
        json: async () => body,
    } as any;
}

/** Returns a valid interview session payload for route tests. */
function buildInterviewSession() {
    return {
        id: "session-1",
        status: "IN_PROGRESS",
        candidateId: "candidate-1",
        application: {
            job: {
                codingCategories: [],
                interviewContent: {
                    codingPrompt: "Write a function",
                    codingAnswer: "function solve() {}",
                    expectedOutput: "42",
                },
            },
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.after.mockImplementation(() => undefined);
});

describe("POST /api/interviews/session/[sessionId]/process", () => {
    it("rejects skip-auth requests without an authenticated session", async () => {
        mocks.getServerSession.mockResolvedValue(null);

        const response = await POST(
            makeRequest({ finalCode: "code", userId: "victim-1" }, "?skip-auth=true"),
            routeContext as any
        );

        expect(response.status).toBe(401);
        expect(mocks.findFirst).not.toHaveBeenCalled();
        expect(mocks.updateMany).not.toHaveBeenCalled();
    });

    it("fails before claiming processing when interview content is missing", async () => {
        const session = buildInterviewSession();
        session.application.job.interviewContent = null as any;
        mocks.getServerSession.mockResolvedValue({ user: { id: "candidate-1" } });
        mocks.findFirst.mockResolvedValue(session);

        const response = await POST(makeRequest({ finalCode: "code" }), routeContext as any);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toContain("Interview content is missing");
        expect(mocks.updateMany).not.toHaveBeenCalled();
        expect(mocks.after).not.toHaveBeenCalled();
    });

    it("treats a concurrent claim as idempotent when processing already started", async () => {
        mocks.getServerSession.mockResolvedValue({ user: { id: "candidate-1" } });
        mocks.findFirst
            .mockResolvedValueOnce(buildInterviewSession())
            .mockResolvedValueOnce({ status: "PROCESSING" });
        mocks.updateMany.mockResolvedValue({ count: 0 });

        const response = await POST(makeRequest({ finalCode: "code" }), routeContext as any);
        const body = await response.json();

        expect(response.status).toBe(202);
        expect(body.status).toBe("PROCESSING");
        expect(mocks.after).not.toHaveBeenCalled();
    });

    it("claims processing for an authenticated owner and schedules background work", async () => {
        mocks.getServerSession.mockResolvedValue({ user: { id: "candidate-1" } });
        mocks.findFirst.mockResolvedValue(buildInterviewSession());
        mocks.updateMany.mockResolvedValue({ count: 1 });

        const response = await POST(makeRequest({ finalCode: "code" }), routeContext as any);
        const body = await response.json();

        expect(response.status).toBe(202);
        expect(body.status).toBe("PROCESSING");
        expect(mocks.updateMany).toHaveBeenCalledWith({
            where: {
                id: "session-1",
                candidateId: "candidate-1",
                status: "IN_PROGRESS",
            },
            data: { status: "PROCESSING" },
        });
        expect(mocks.after).toHaveBeenCalledOnce();
    });
});
