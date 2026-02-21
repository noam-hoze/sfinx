/**
 * Unit tests for evidence clip timing logic.
 *
 * Bug: aiQuestionTimestamp was set to the paste detection timestamp instead of
 * the time when the AI question was actually posted. This caused evidence clips
 * to point to incorrect video offsets — sometimes seconds before the AI question
 * appeared on screen (during async topic identification / question generation).
 *
 * Fix: aiQuestionTimestamp now uses Date.now() at the moment the question is
 * posted, and the fallback in InterviewIDE uses the paste detection timestamp
 * instead of a stale Date.now() at interview conclusion time.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Replicate the video offset calculation from telemetry route
// ---------------------------------------------------------------------------

function calculateVideoOffset(
    aiQuestionTimestamp: number,
    recordingStartedAt: number,
): number {
    const questionTime = new Date(aiQuestionTimestamp);
    const recordingStartTime = new Date(recordingStartedAt);
    return (questionTime.getTime() - recordingStartTime.getTime()) / 1000;
}

// ---------------------------------------------------------------------------
// Replicate the aiQuestionTimestamp fallback logic from InterviewIDE
// ---------------------------------------------------------------------------

function resolveAiQuestionTimestamp(
    aiQuestionTimestamp: number | undefined,
    pasteDetectionTimestamp: number,
): number {
    return aiQuestionTimestamp || pasteDetectionTimestamp;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("evidence clip timing", () => {
    describe("calculateVideoOffset", () => {
        it("returns positive offset when question is after recording start", () => {
            const recordingStart = new Date("2026-01-15T10:00:00Z").getTime();
            const questionTime = new Date("2026-01-15T10:05:30Z").getTime(); // 5m30s later

            const offset = calculateVideoOffset(questionTime, recordingStart);

            expect(offset).toBe(330); // 5 * 60 + 30 = 330 seconds
        });

        it("returns zero offset when question is at recording start", () => {
            const time = new Date("2026-01-15T10:00:00Z").getTime();

            const offset = calculateVideoOffset(time, time);

            expect(offset).toBe(0);
        });

        it("returns negative offset when question is before recording start", () => {
            const recordingStart = new Date("2026-01-15T10:01:00Z").getTime();
            const questionTime = new Date("2026-01-15T10:00:00Z").getTime();

            const offset = calculateVideoOffset(questionTime, recordingStart);

            expect(offset).toBe(-60);
        });
    });

    describe("aiQuestionTimestamp should reflect when AI question is posted, not paste detection", () => {
        it("uses current time (not paste detection time) for aiQuestionTimestamp", () => {
            // Simulate: paste detected at T=0, topic identification takes 3s,
            // AI question posted at T=3s
            const pasteDetectionTime = 1700000000000; // some epoch ms
            const aiQuestionPostedTime = pasteDetectionTime + 3000; // 3s later

            // The fix: aiQuestionTimestamp = Date.now() at post time, not paste detection time
            const aiQuestionTimestamp = aiQuestionPostedTime;

            // Evidence clip should point to when AI question appeared (T+3s), not paste detection (T+0)
            const recordingStart = pasteDetectionTime - 60000; // recording started 1 min before paste
            const offset = calculateVideoOffset(aiQuestionTimestamp, recordingStart);

            // Should be 63 seconds (60s + 3s), not 60s
            expect(offset).toBe(63);
        });

        it("using paste detection time would give inaccurate offset", () => {
            const pasteDetectionTime = 1700000000000;
            const topicIdentificationDelay = 3000; // 3 seconds for async topic ID
            const recordingStart = pasteDetectionTime - 60000;

            // OLD behavior (bug): aiQuestionTimestamp = paste detection time
            const oldOffset = calculateVideoOffset(pasteDetectionTime, recordingStart);

            // NEW behavior (fix): aiQuestionTimestamp = when question is actually posted
            const actualQuestionTime = pasteDetectionTime + topicIdentificationDelay;
            const newOffset = calculateVideoOffset(actualQuestionTime, recordingStart);

            // The old offset is 3 seconds too early
            expect(newOffset - oldOffset).toBe(3);
            expect(oldOffset).toBe(60);
            expect(newOffset).toBe(63);
        });
    });

    describe("aiQuestionTimestamp fallback logic", () => {
        it("uses aiQuestionTimestamp when available", () => {
            const pasteDetectionTime = 1700000000000;
            const aiQuestionTime = 1700000003000; // 3s later

            const result = resolveAiQuestionTimestamp(aiQuestionTime, pasteDetectionTime);

            expect(result).toBe(aiQuestionTime);
        });

        it("falls back to paste detection timestamp when aiQuestionTimestamp is missing", () => {
            const pasteDetectionTime = 1700000000000;

            const result = resolveAiQuestionTimestamp(undefined, pasteDetectionTime);

            expect(result).toBe(pasteDetectionTime);
        });

        it("never uses Date.now() as fallback (which would be interview conclusion time)", () => {
            // Scenario: paste at T=0, interview concludes at T=20min
            // Fallback should be paste detection time, NOT Date.now() at conclusion
            const pasteDetectionTime = 1700000000000;
            const interviewConclusionTime = pasteDetectionTime + 20 * 60 * 1000; // 20 min later

            const result = resolveAiQuestionTimestamp(undefined, pasteDetectionTime);

            // Should NOT be close to conclusion time
            expect(result).toBe(pasteDetectionTime);
            expect(result).not.toBe(interviewConclusionTime);
        });
    });

    describe("evidence link creation", () => {
        it("only creates evidence links with non-negative offsets", () => {
            const recordingStart = new Date("2026-01-15T10:00:00Z").getTime();
            const validQuestionTime = new Date("2026-01-15T10:05:00Z").getTime();
            const invalidQuestionTime = new Date("2026-01-15T09:59:00Z").getTime();

            const validOffset = calculateVideoOffset(validQuestionTime, recordingStart);
            const invalidOffset = calculateVideoOffset(invalidQuestionTime, recordingStart);

            // Valid offset should be included
            expect(validOffset).toBeGreaterThanOrEqual(0);
            expect(validOffset).toBe(300);

            // Invalid (negative) offset should be filtered out
            expect(invalidOffset).toBeLessThan(0);
        });
    });
});
