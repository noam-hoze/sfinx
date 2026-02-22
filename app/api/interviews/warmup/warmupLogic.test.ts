/**
 * Unit tests for warmup activation validation logic.
 *
 * The warmup/activate route validates request fields and handles Prisma
 * P2025 (record not found) errors. These pure checks are extracted here.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Replicated from warmup/activate/route.ts (lines 29-35)
// ---------------------------------------------------------------------------

interface ActivationRequest {
    applicationId?: string;
    companyId?: string;
    jobId?: string;
}

function validateActivationRequest(body: ActivationRequest): { valid: boolean; error?: string } {
    if (!body.applicationId || !body.companyId || !body.jobId) {
        return { valid: false, error: "applicationId, companyId, and jobId are required" };
    }
    return { valid: true };
}

// ---------------------------------------------------------------------------
// Replicated from warmup/activate/route.ts (line 162)
// ---------------------------------------------------------------------------

function isPrismaNotFoundError(error: unknown): boolean {
    return typeof error === "object" && error !== null && (error as any).code === "P2025";
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("warmup logic", () => {
    describe("validateActivationRequest", () => {
        it("returns error when applicationId is missing", () => {
            expect(validateActivationRequest({
                companyId: "c1",
                jobId: "j1",
            }).valid).toBe(false);
        });

        it("returns error when companyId is missing", () => {
            expect(validateActivationRequest({
                applicationId: "a1",
                jobId: "j1",
            }).valid).toBe(false);
        });

        it("returns error when jobId is missing", () => {
            expect(validateActivationRequest({
                applicationId: "a1",
                companyId: "c1",
            }).valid).toBe(false);
        });

        it("passes when all three fields are present", () => {
            expect(validateActivationRequest({
                applicationId: "a1",
                companyId: "c1",
                jobId: "j1",
            }).valid).toBe(true);
        });

        it("ignores extra fields", () => {
            expect(validateActivationRequest({
                applicationId: "a1",
                companyId: "c1",
                jobId: "j1",
                extra: "data",
            } as any).valid).toBe(true);
        });
    });

    describe("isPrismaNotFoundError", () => {
        it("returns true for error with code P2025", () => {
            expect(isPrismaNotFoundError({ code: "P2025", message: "Record not found" })).toBe(true);
        });

        it("returns false for error with different code", () => {
            expect(isPrismaNotFoundError({ code: "P2002", message: "Unique constraint" })).toBe(false);
        });

        it("returns false for error without code", () => {
            expect(isPrismaNotFoundError(new Error("generic error"))).toBe(false);
        });

        it("returns false for null", () => {
            expect(isPrismaNotFoundError(null)).toBe(false);
        });

        it("returns false for undefined", () => {
            expect(isPrismaNotFoundError(undefined)).toBe(false);
        });
    });
});
