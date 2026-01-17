/**
 * Unit tests for coding summary route validation.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { log } from "app/shared/services";

vi.mock("openai", () => ({ default: vi.fn() }));
vi.mock("app/shared/services", () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("lib/prisma", () => ({
    default: {
        interviewSession: { findUnique: vi.fn() },
        iteration: { findMany: vi.fn() },
        externalToolUsage: { findMany: vi.fn() },
        codingSummary: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    },
}));

/**
 * Build a NextRequest for POST.
 */
function buildRequest(payload: Record<string, unknown>) {
    return new NextRequest("http://localhost", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
});

describe("POST /api/interviews/generate-coding-summary", () => {
    it("returns 500 when OpenAI key is missing", async () => {
        const response = await POST(buildRequest({ sessionId: "sess-1" }) as any);
        expect(response.status).toBe(500);
        expect(log.error).toHaveBeenCalled();
    });

    it("returns 500 when required fields are missing", async () => {
        process.env.OPENAI_API_KEY = "test-key";
        const response = await POST(buildRequest({ sessionId: "sess-1" }) as any);
        expect(response.status).toBe(500);
        expect(log.error).toHaveBeenCalled();
    });
});
