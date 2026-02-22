/**
 * Unit tests for the async interview processing logic.
 *
 * The /process route orchestrates 5 post-interview steps using Next.js after().
 * Each step is individually try/caught so one failure does not abort the rest.
 * This file tests the pure logic: normalizeSessionId, idempotency guard,
 * and the step-isolation pattern.
 */

import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Replicated from process/route.ts (lines 28-31)
// ---------------------------------------------------------------------------

function normalizeSessionId(sessionId: string | string[] | undefined): string {
    if (Array.isArray(sessionId)) return sessionId[0] ?? "";
    return sessionId ?? "";
}

// ---------------------------------------------------------------------------
// Replicated idempotency check (lines 73-76)
// ---------------------------------------------------------------------------

type SessionStatus = "WARMUP" | "IN_PROGRESS" | "PROCESSING" | "COMPLETED";

interface IdempotencyResult {
    shouldProcess: boolean;
    returnStatus?: number;
}

function checkIdempotency(status: SessionStatus): IdempotencyResult {
    if (status === "PROCESSING" || status === "COMPLETED") {
        return { shouldProcess: false, returnStatus: 202 };
    }
    return { shouldProcess: true };
}

// ---------------------------------------------------------------------------
// Replicated step-isolation pattern (lines 106-237)
// ---------------------------------------------------------------------------

async function executeStepsWithIsolation(
    steps: Array<() => Promise<void>>,
): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;

    for (const step of steps) {
        try {
            await step();
            succeeded++;
        } catch {
            failed++;
        }
    }

    return { succeeded, failed };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("process route logic", () => {
    describe("normalizeSessionId", () => {
        it("returns first element of array", () => {
            expect(normalizeSessionId(["abc", "def"])).toBe("abc");
        });

        it("returns string as-is", () => {
            expect(normalizeSessionId("abc")).toBe("abc");
        });

        it("returns empty string for undefined", () => {
            expect(normalizeSessionId(undefined)).toBe("");
        });

        it("returns empty string for empty array", () => {
            expect(normalizeSessionId([])).toBe("");
        });
    });

    describe("idempotency guard", () => {
        it("skips processing when status is PROCESSING", () => {
            const result = checkIdempotency("PROCESSING");
            expect(result.shouldProcess).toBe(false);
            expect(result.returnStatus).toBe(202);
        });

        it("skips processing when status is COMPLETED", () => {
            const result = checkIdempotency("COMPLETED");
            expect(result.shouldProcess).toBe(false);
            expect(result.returnStatus).toBe(202);
        });

        it("allows processing when status is IN_PROGRESS", () => {
            const result = checkIdempotency("IN_PROGRESS");
            expect(result.shouldProcess).toBe(true);
        });

        it("allows processing when status is WARMUP", () => {
            const result = checkIdempotency("WARMUP");
            expect(result.shouldProcess).toBe(true);
        });
    });

    describe("step isolation", () => {
        it("all steps succeed → all callbacks called", async () => {
            const step1 = vi.fn().mockResolvedValue(undefined);
            const step2 = vi.fn().mockResolvedValue(undefined);
            const step3 = vi.fn().mockResolvedValue(undefined);

            const result = await executeStepsWithIsolation([step1, step2, step3]);

            expect(step1).toHaveBeenCalledTimes(1);
            expect(step2).toHaveBeenCalledTimes(1);
            expect(step3).toHaveBeenCalledTimes(1);
            expect(result.succeeded).toBe(3);
            expect(result.failed).toBe(0);
        });

        it("step 1 throws → steps 2-5 still execute", async () => {
            const step1 = vi.fn().mockRejectedValue(new Error("step 1 failed"));
            const step2 = vi.fn().mockResolvedValue(undefined);
            const step3 = vi.fn().mockResolvedValue(undefined);
            const step4 = vi.fn().mockResolvedValue(undefined);
            const step5 = vi.fn().mockResolvedValue(undefined);

            const result = await executeStepsWithIsolation([step1, step2, step3, step4, step5]);

            expect(step2).toHaveBeenCalledTimes(1);
            expect(step3).toHaveBeenCalledTimes(1);
            expect(step4).toHaveBeenCalledTimes(1);
            expect(step5).toHaveBeenCalledTimes(1);
            expect(result.succeeded).toBe(4);
            expect(result.failed).toBe(1);
        });

        it("step 3 throws → steps 4 and 5 still execute", async () => {
            const step1 = vi.fn().mockResolvedValue(undefined);
            const step2 = vi.fn().mockResolvedValue(undefined);
            const step3 = vi.fn().mockRejectedValue(new Error("step 3 failed"));
            const step4 = vi.fn().mockResolvedValue(undefined);
            const step5 = vi.fn().mockResolvedValue(undefined);

            const result = await executeStepsWithIsolation([step1, step2, step3, step4, step5]);

            expect(step4).toHaveBeenCalledTimes(1);
            expect(step5).toHaveBeenCalledTimes(1);
            expect(result.succeeded).toBe(4);
            expect(result.failed).toBe(1);
        });

        it("multiple steps fail → remaining steps still execute", async () => {
            const step1 = vi.fn().mockRejectedValue(new Error("fail 1"));
            const step2 = vi.fn().mockResolvedValue(undefined);
            const step3 = vi.fn().mockRejectedValue(new Error("fail 3"));
            const step4 = vi.fn().mockResolvedValue(undefined);

            const result = await executeStepsWithIsolation([step1, step2, step3, step4]);

            expect(result.succeeded).toBe(2);
            expect(result.failed).toBe(2);
        });
    });
});
