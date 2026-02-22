/**
 * Unit tests for evaluate-code-change route logic.
 *
 * Tests the validation of incoming request fields and the video offset
 * calculation that positions evidence clips in the recording timeline.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Replicated from evaluate-code-change/route.ts (lines 23-28)
// ---------------------------------------------------------------------------

interface CodeChangeRequest {
    sessionId?: string;
    diff?: string;
    timestamp?: string;
    jobCategories?: Array<{ name: string; description: string }>;
}

function validateCodeChangeRequest(body: CodeChangeRequest): { valid: boolean; error?: string } {
    if (!body.sessionId || !body.diff || !body.timestamp || !body.jobCategories) {
        return { valid: false, error: "Missing required fields" };
    }
    return { valid: true };
}

// ---------------------------------------------------------------------------
// Replicated from evaluate-code-change/route.ts (lines 154-160)
// ---------------------------------------------------------------------------

function calculateVideoOffset(
    timestamp: string,
    recordingStartedAt: Date | null,
): number {
    if (!recordingStartedAt) return 0;
    const changeTimestamp = new Date(timestamp);
    return Math.floor((changeTimestamp.getTime() - recordingStartedAt.getTime()) / 1000);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("evaluate-code-change logic", () => {
    describe("validateCodeChangeRequest", () => {
        it("returns error when sessionId is missing", () => {
            const result = validateCodeChangeRequest({
                diff: "+console.log",
                timestamp: "2026-01-01T00:00:00Z",
                jobCategories: [{ name: "Python", description: "test" }],
            });
            expect(result.valid).toBe(false);
        });

        it("returns error when diff is missing", () => {
            const result = validateCodeChangeRequest({
                sessionId: "s1",
                timestamp: "2026-01-01T00:00:00Z",
                jobCategories: [{ name: "Python", description: "test" }],
            });
            expect(result.valid).toBe(false);
        });

        it("returns error when timestamp is missing", () => {
            const result = validateCodeChangeRequest({
                sessionId: "s1",
                diff: "+code",
                jobCategories: [{ name: "Python", description: "test" }],
            });
            expect(result.valid).toBe(false);
        });

        it("returns error when jobCategories is missing", () => {
            const result = validateCodeChangeRequest({
                sessionId: "s1",
                diff: "+code",
                timestamp: "2026-01-01T00:00:00Z",
            });
            expect(result.valid).toBe(false);
        });

        it("returns valid when all fields present", () => {
            const result = validateCodeChangeRequest({
                sessionId: "s1",
                diff: "+code",
                timestamp: "2026-01-01T00:00:00Z",
                jobCategories: [{ name: "Python", description: "test" }],
            });
            expect(result.valid).toBe(true);
        });
    });

    describe("calculateVideoOffset", () => {
        it("returns 0 when recordingStartedAt is null", () => {
            expect(calculateVideoOffset("2026-01-01T00:01:00Z", null)).toBe(0);
        });

        it("returns positive seconds when timestamp is after recording start", () => {
            const recording = new Date("2026-01-01T00:00:00Z");
            // 90 seconds later
            expect(calculateVideoOffset("2026-01-01T00:01:30Z", recording)).toBe(90);
        });

        it("returns negative offset when timestamp is before recording start", () => {
            // Per evidence-clip-timing.md: no silent offset clamps
            const recording = new Date("2026-01-01T00:01:00Z");
            expect(calculateVideoOffset("2026-01-01T00:00:00Z", recording)).toBe(-60);
        });

        it("returns 0 when timestamp equals recording start", () => {
            const recording = new Date("2026-01-01T00:00:00Z");
            expect(calculateVideoOffset("2026-01-01T00:00:00Z", recording)).toBe(0);
        });

        it("floors fractional seconds", () => {
            const recording = new Date("2026-01-01T00:00:00.000Z");
            // 1500ms = 1.5s → floors to 1
            expect(calculateVideoOffset("2026-01-01T00:00:01.500Z", recording)).toBe(1);
        });
    });
});
