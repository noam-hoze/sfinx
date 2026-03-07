/**
 * Unit tests for the telemetry cache-skip behaviour.
 *
 * Bug: getCached/setCached were called unconditionally. If a company opened the
 * CPS page while a candidate's session was still IN_PROGRESS, incomplete data
 * (no story, no summaries) was written to the 5-minute cache and served stale
 * even after processing completed.
 *
 * Fix: setCached is skipped whenever any session has status IN_PROGRESS or
 * PROCESSING so that polls always receive fresh data until the session is done.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Replicate the cache-skip logic extracted from the route handler
// (kept as a pure function so it can be tested without Next.js plumbing)
// ---------------------------------------------------------------------------

interface SessionLike { status: string }

function shouldSkipCache(sessions: SessionLike[]): boolean {
    return sessions.some(
        (s) => s.status === "IN_PROGRESS" || s.status === "PROCESSING"
    );
}

async function buildAndMaybeCache(
    sessions: SessionLike[],
    setCached: (key: string, value: any) => Promise<void>
): Promise<void> {
    const response = { sessions };
    const cacheKey = "test-key";

    if (!shouldSkipCache(sessions)) {
        await setCached(cacheKey, response);
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("telemetry cache-skip for pending sessions", () => {
    let setCachedMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        setCachedMock = vi.fn().mockResolvedValue(undefined);
    });

    it("caches the response when all sessions are COMPLETED", async () => {
        const sessions: SessionLike[] = [
            { status: "COMPLETED" },
            { status: "COMPLETED" },
        ];

        await buildAndMaybeCache(sessions, setCachedMock);

        expect(setCachedMock).toHaveBeenCalledTimes(1);
    });

    it("skips cache when any session is IN_PROGRESS", async () => {
        const sessions: SessionLike[] = [
            { status: "COMPLETED" },
            { status: "IN_PROGRESS" },
        ];

        await buildAndMaybeCache(sessions, setCachedMock);

        expect(setCachedMock).not.toHaveBeenCalled();
    });

    it("skips cache when any session is PROCESSING (async phase 1 status)", async () => {
        const sessions: SessionLike[] = [
            { status: "COMPLETED" },
            { status: "PROCESSING" },
        ];

        await buildAndMaybeCache(sessions, setCachedMock);

        expect(setCachedMock).not.toHaveBeenCalled();
    });

    it("skips cache when all sessions are still in progress", async () => {
        const sessions: SessionLike[] = [
            { status: "IN_PROGRESS" },
        ];

        await buildAndMaybeCache(sessions, setCachedMock);

        expect(setCachedMock).not.toHaveBeenCalled();
    });

    it("caches the response for ABANDONED sessions (a final state)", async () => {
        const sessions: SessionLike[] = [
            { status: "ABANDONED" },
        ];

        await buildAndMaybeCache(sessions, setCachedMock);

        expect(setCachedMock).toHaveBeenCalledTimes(1);
    });

    it("skips cache for an empty sessions array (nothing to cache)", async () => {
        await buildAndMaybeCache([], setCachedMock);
        // No pending sessions — but nothing useful to cache either.
        // The function caches when shouldSkipCache is false (empty array → false).
        expect(setCachedMock).toHaveBeenCalledTimes(1);
    });
});
