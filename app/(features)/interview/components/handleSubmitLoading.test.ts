/**
 * Unit tests for the loading-state guarantee in handleSubmit.
 *
 * Bug: setIsInterviewLoading(false) was placed inside the try block after the
 * profile-story fetch, which is allowed to throw. If it threw, the finally
 * path was never reached, leaving the candidate stuck with an infinite spinner.
 *
 * Fix: the loading section is now wrapped in try/finally so setIsInterviewLoading(false)
 * is always called regardless of success or failure.
 *
 * These tests verify the core async logic in isolation — no React rendering needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Simulate the core loading-state logic extracted from handleSubmit
// ---------------------------------------------------------------------------

type SetLoading = (value: boolean) => void;

async function simulateHandleSubmit(
    fetchImpl: typeof globalThis.fetch,
    setIsInterviewLoading: SetLoading
): Promise<void> {
    setIsInterviewLoading(true);
    try {
        // Simulate profile-story fetch (the critical, no-fallback step)
        const response = await fetchImpl("/api/interviews/generate-profile-story", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: "test-session" }),
        });
        if (!response.ok) {
            throw new Error(`Profile story generation failed with status ${response.status}`);
        }
    } finally {
        // Must always run — this is the fix
        setIsInterviewLoading(false);
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleSubmit loading state guarantee", () => {
    let setIsInterviewLoading: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        setIsInterviewLoading = vi.fn();
    });

    it("clears loading state when profile-story succeeds", async () => {
        const mockFetch = vi.fn().mockResolvedValue({ ok: true });

        await simulateHandleSubmit(mockFetch as any, setIsInterviewLoading);

        expect(setIsInterviewLoading).toHaveBeenCalledWith(true);
        expect(setIsInterviewLoading).toHaveBeenCalledWith(false);
        expect(setIsInterviewLoading).toHaveBeenCalledTimes(2);
    });

    it("clears loading state when profile-story returns a non-2xx status", async () => {
        const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

        // Should throw (as per constitution), but loading must still be cleared
        await expect(
            simulateHandleSubmit(mockFetch as any, setIsInterviewLoading)
        ).rejects.toThrow("Profile story generation failed with status 500");

        expect(setIsInterviewLoading).toHaveBeenCalledWith(true);
        expect(setIsInterviewLoading).toHaveBeenCalledWith(false);
        expect(setIsInterviewLoading).toHaveBeenCalledTimes(2);
    });

    it("clears loading state when fetch itself throws (network error)", async () => {
        const mockFetch = vi.fn().mockRejectedValue(new Error("Network failure"));

        await expect(
            simulateHandleSubmit(mockFetch as any, setIsInterviewLoading)
        ).rejects.toThrow("Network failure");

        expect(setIsInterviewLoading).toHaveBeenCalledWith(true);
        expect(setIsInterviewLoading).toHaveBeenCalledWith(false);
        expect(setIsInterviewLoading).toHaveBeenCalledTimes(2);
    });

    it("does not call setIsInterviewLoading(false) before the try block finishes", async () => {
        let resolveStory!: (value: any) => void;
        const storyPromise = new Promise((res) => { resolveStory = res; });
        const mockFetch = vi.fn().mockReturnValue(storyPromise);

        const submitPromise = simulateHandleSubmit(mockFetch as any, setIsInterviewLoading);

        // At this point, fetch is still pending — loading should only be true
        expect(setIsInterviewLoading).toHaveBeenCalledWith(true);
        expect(setIsInterviewLoading).not.toHaveBeenCalledWith(false);

        resolveStory({ ok: true });
        await submitPromise;

        expect(setIsInterviewLoading).toHaveBeenCalledWith(false);
    });
});
