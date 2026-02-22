/**
 * Unit tests for evidence clip timing across all evidence types.
 *
 * Each evidence type computes a videoOffset from the formula:
 *   videoOffset = floor((eventTimestamp - recordingStartedAt) / 1000)
 *
 * Per AGENTS.md Principle I (Hard Ban on Fallbacks) and evidence-clip-timing.md:
 * - No silent clamping (Math.max removed)
 * - No hidden fallbacks (telemetryData.createdAt, new Date(), videoOffset=0)
 * - When recordingStartedAt is null, evidence creation is skipped with explicit log
 *
 * This file replicates (Pattern B) the pure offset logic from each route handler.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// 1. Background evidence clips
//    Source: background-summary/route.ts (lines 534-546)
//    recordingStartedAt required — returns null when missing (no fallback)
// ---------------------------------------------------------------------------

function calculateBackgroundEvidenceOffset(
    recordTimestamp: Date,
    recordingStartedAt: Date | null,
): number | null {
    if (!recordingStartedAt) return null;
    const recordingStart = new Date(recordingStartedAt);
    return Math.floor(
        (recordTimestamp.getTime() - recordingStart.getTime()) / 1000,
    );
}

/**
 * Calculates clip duration from the gap to the next evidence record.
 * Source: background-summary/route.ts (lines 556-562)
 */
function calculateBackgroundClipDuration(
    currentTimestamp: Date,
    nextTimestamp: Date | null,
): number {
    const DEFAULT_DURATION = 15;
    if (!nextTimestamp) return DEFAULT_DURATION;
    return Math.floor(
        (nextTimestamp.getTime() - currentTimestamp.getTime()) / 1000,
    );
}

// ---------------------------------------------------------------------------
// 2. Code contribution evidence clips
//    Source: evaluate-code-change/route.ts (lines 153-161)
//    recordingStartedAt required — returns null when missing (no fallback)
// ---------------------------------------------------------------------------

function calculateCodeContributionOffset(
    timestamp: string,
    recordingStartedAt: Date | null,
): number | null {
    if (!recordingStartedAt) return null;
    const changeTimestamp = new Date(timestamp);
    return Math.floor(
        (changeTimestamp.getTime() - recordingStartedAt.getTime()) / 1000,
    );
}

// ---------------------------------------------------------------------------
// 3. Iteration (code execution) evidence clips
//    Source: iterations/route.ts (lines 94-95, 104)
//    timestamp is required (validated in request). No new Date() fallback.
//    Skips evidence creation when videoOffset < 0.
// ---------------------------------------------------------------------------

function calculateIterationOffset(
    timestamp: string,
    recordingStartedAt: Date,
): { videoOffset: number; shouldCreateEvidence: boolean } {
    const iterationTimestamp = new Date(timestamp);
    const videoOffset = Math.floor(
        (iterationTimestamp.getTime() - recordingStartedAt.getTime()) / 1000,
    );
    return {
        videoOffset,
        shouldCreateEvidence: videoOffset >= 0,
    };
}

// ---------------------------------------------------------------------------
// 4. Paste chapter (external tool) evidence clips
//    Source: paste-chapter/route.ts (lines 66-68, 75)
//    Rejects (400 error) when videoOffset < 0.
// ---------------------------------------------------------------------------

function calculatePasteChapterOffset(
    timestamp: number,
    recordingStartedAt: Date,
): { videoOffset: number; isValid: boolean } {
    const pasteTimestamp = new Date(timestamp);
    const videoOffset = Math.floor(
        (pasteTimestamp.getTime() - recordingStartedAt.getTime()) / 1000,
    );
    return {
        videoOffset,
        isValid: videoOffset >= 0,
    };
}

// ---------------------------------------------------------------------------
// 5. Background answer evidence clips (evaluate-answer route)
//    Source: evaluate-answer/route.ts (lines 288-297)
//    recordingStartedAt required — returns null when missing (no fallback)
// ---------------------------------------------------------------------------

function calculateAnswerEvidenceOffset(
    timestamp: string,
    recordingStartedAt: Date | null,
): number | null {
    if (!recordingStartedAt) return null;
    const recordingStart = new Date(recordingStartedAt).getTime();
    const answerTime = new Date(timestamp).getTime();
    return Math.floor((answerTime - recordingStart) / 1000);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("evidence clip timing", () => {
    const RECORDING_START = new Date("2026-01-15T10:00:00.000Z");

    // ============================
    // Background Evidence Clips
    // ============================
    describe("background evidence offset", () => {
        it("computes positive offset when answer is after recording start", () => {
            const answerTime = new Date("2026-01-15T10:02:30.000Z");
            expect(calculateBackgroundEvidenceOffset(answerTime, RECORDING_START)).toBe(150);
        });

        it("returns 0 when answer is exactly at recording start", () => {
            expect(calculateBackgroundEvidenceOffset(RECORDING_START, RECORDING_START)).toBe(0);
        });

        it("allows negative offset (no clamping per evidence-clip-timing.md)", () => {
            const earlyAnswer = new Date("2026-01-15T09:59:00.000Z");
            expect(calculateBackgroundEvidenceOffset(earlyAnswer, RECORDING_START)).toBe(-60);
        });

        it("returns null when recordingStartedAt is null (no fallback)", () => {
            const answerTime = new Date("2026-01-15T10:00:20.000Z");
            expect(calculateBackgroundEvidenceOffset(answerTime, null)).toBeNull();
        });

        it("floors fractional seconds", () => {
            const answerTime = new Date("2026-01-15T10:00:01.999Z");
            expect(calculateBackgroundEvidenceOffset(answerTime, RECORDING_START)).toBe(1);
        });

        it("handles large offsets (45 minutes)", () => {
            const lateAnswer = new Date("2026-01-15T10:45:00.000Z");
            expect(calculateBackgroundEvidenceOffset(lateAnswer, RECORDING_START)).toBe(2700);
        });
    });

    describe("background clip duration", () => {
        it("returns gap between current and next evidence timestamp", () => {
            const current = new Date("2026-01-15T10:01:00.000Z");
            const next = new Date("2026-01-15T10:02:30.000Z");
            expect(calculateBackgroundClipDuration(current, next)).toBe(90);
        });

        it("returns default 15s when no next record exists (last question)", () => {
            const current = new Date("2026-01-15T10:05:00.000Z");
            expect(calculateBackgroundClipDuration(current, null)).toBe(15);
        });

        it("returns short duration for rapid-fire questions", () => {
            const current = new Date("2026-01-15T10:01:00.000Z");
            const next = new Date("2026-01-15T10:01:05.000Z");
            expect(calculateBackgroundClipDuration(current, next)).toBe(5);
        });

        it("floors fractional seconds in duration", () => {
            const current = new Date("2026-01-15T10:00:00.000Z");
            const next = new Date("2026-01-15T10:00:07.800Z");
            expect(calculateBackgroundClipDuration(current, next)).toBe(7);
        });
    });

    // ============================
    // Code Contribution Evidence Clips
    // ============================
    describe("code contribution offset", () => {
        it("computes positive offset for code change after recording start", () => {
            expect(calculateCodeContributionOffset("2026-01-15T10:05:00.000Z", RECORDING_START)).toBe(300);
        });

        it("returns null when recordingStartedAt is null (no fallback)", () => {
            expect(calculateCodeContributionOffset("2026-01-15T10:05:00.000Z", null)).toBeNull();
        });

        it("allows negative offset (no clamping per evidence-clip-timing.md)", () => {
            expect(calculateCodeContributionOffset("2026-01-15T09:59:30.000Z", RECORDING_START)).toBe(-30);
        });

        it("returns 0 when timestamp equals recording start", () => {
            expect(calculateCodeContributionOffset("2026-01-15T10:00:00.000Z", RECORDING_START)).toBe(0);
        });

        it("floors fractional seconds", () => {
            expect(calculateCodeContributionOffset("2026-01-15T10:00:01.500Z", RECORDING_START)).toBe(1);
        });
    });

    // ============================
    // Iteration Evidence Clips
    // ============================
    describe("iteration offset", () => {
        it("computes positive offset and allows evidence creation", () => {
            const result = calculateIterationOffset("2026-01-15T10:10:00.000Z", RECORDING_START);
            expect(result.videoOffset).toBe(600);
            expect(result.shouldCreateEvidence).toBe(true);
        });

        it("returns 0 offset and allows evidence when timestamp equals recording start", () => {
            const result = calculateIterationOffset("2026-01-15T10:00:00.000Z", RECORDING_START);
            expect(result.videoOffset).toBe(0);
            expect(result.shouldCreateEvidence).toBe(true);
        });

        it("skips evidence creation when offset is negative", () => {
            const result = calculateIterationOffset("2026-01-15T09:58:00.000Z", RECORDING_START);
            expect(result.videoOffset).toBe(-120);
            expect(result.shouldCreateEvidence).toBe(false);
        });

        it("floors fractional seconds", () => {
            const result = calculateIterationOffset("2026-01-15T10:00:02.700Z", RECORDING_START);
            expect(result.videoOffset).toBe(2);
            expect(result.shouldCreateEvidence).toBe(true);
        });
    });

    // ============================
    // Paste Chapter Evidence Clips
    // ============================
    describe("paste chapter offset", () => {
        it("computes positive offset for paste after recording start", () => {
            const pasteTime = new Date("2026-01-15T10:03:00.000Z").getTime();
            const result = calculatePasteChapterOffset(pasteTime, RECORDING_START);
            expect(result.videoOffset).toBe(180);
            expect(result.isValid).toBe(true);
        });

        it("allows zero offset (paste at exact recording start)", () => {
            const result = calculatePasteChapterOffset(RECORDING_START.getTime(), RECORDING_START);
            expect(result.videoOffset).toBe(0);
            expect(result.isValid).toBe(true);
        });

        it("rejects negative offset (paste before recording)", () => {
            const earlyPaste = new Date("2026-01-15T09:59:00.000Z").getTime();
            const result = calculatePasteChapterOffset(earlyPaste, RECORDING_START);
            expect(result.videoOffset).toBe(-60);
            expect(result.isValid).toBe(false);
        });

        it("floors fractional seconds", () => {
            const pasteTime = new Date("2026-01-15T10:00:03.999Z").getTime();
            const result = calculatePasteChapterOffset(pasteTime, RECORDING_START);
            expect(result.videoOffset).toBe(3);
            expect(result.isValid).toBe(true);
        });
    });

    // ============================
    // Background Answer Evidence (evaluate-answer route)
    // ============================
    describe("answer evidence offset (evaluate-answer)", () => {
        it("computes positive offset for answer after recording start", () => {
            expect(calculateAnswerEvidenceOffset("2026-01-15T10:01:30.000Z", RECORDING_START)).toBe(90);
        });

        it("returns null when recordingStartedAt is null (no fallback)", () => {
            expect(calculateAnswerEvidenceOffset("2026-01-15T10:01:30.000Z", null)).toBeNull();
        });

        it("allows negative offset (no clamping per evidence-clip-timing.md)", () => {
            expect(calculateAnswerEvidenceOffset("2026-01-15T09:59:00.000Z", RECORDING_START)).toBe(-60);
        });

        it("returns 0 when timestamp equals recording start", () => {
            expect(calculateAnswerEvidenceOffset("2026-01-15T10:00:00.000Z", RECORDING_START)).toBe(0);
        });

        it("floors fractional seconds", () => {
            expect(calculateAnswerEvidenceOffset("2026-01-15T10:00:01.500Z", RECORDING_START)).toBe(1);
        });
    });

    // ============================
    // Cross-type consistency
    // ============================
    describe("cross-type consistency", () => {
        it("all types produce same offset for identical timestamp and recording start", () => {
            const ts = "2026-01-15T10:05:00.000Z";
            const tsDate = new Date(ts);
            const tsMs = tsDate.getTime();

            expect(calculateBackgroundEvidenceOffset(tsDate, RECORDING_START)).toBe(300);
            expect(calculateCodeContributionOffset(ts, RECORDING_START)).toBe(300);
            expect(calculateIterationOffset(ts, RECORDING_START).videoOffset).toBe(300);
            expect(calculatePasteChapterOffset(tsMs, RECORDING_START).videoOffset).toBe(300);
            expect(calculateAnswerEvidenceOffset(ts, RECORDING_START)).toBe(300);
        });

        it("all types allow negative offsets consistently (no clamping)", () => {
            const earlyTs = "2026-01-15T09:59:00.000Z";
            const earlyTsDate = new Date(earlyTs);

            expect(calculateBackgroundEvidenceOffset(earlyTsDate, RECORDING_START)).toBe(-60);
            expect(calculateCodeContributionOffset(earlyTs, RECORDING_START)).toBe(-60);
            expect(calculateIterationOffset(earlyTs, RECORDING_START).videoOffset).toBe(-60);
            expect(calculateAnswerEvidenceOffset(earlyTs, RECORDING_START)).toBe(-60);
        });

        it("null recording returns null for all types that accept it (no fallback to 0)", () => {
            const ts = "2026-01-15T10:05:00.000Z";
            const tsDate = new Date(ts);

            expect(calculateBackgroundEvidenceOffset(tsDate, null)).toBeNull();
            expect(calculateCodeContributionOffset(ts, null)).toBeNull();
            expect(calculateAnswerEvidenceOffset(ts, null)).toBeNull();
        });

        it("all types use Math.floor (never Math.round or Math.ceil)", () => {
            const fractionalTs = "2026-01-15T10:00:01.999Z";
            const fractionalDate = new Date(fractionalTs);
            const fractionalMs = fractionalDate.getTime();

            expect(calculateBackgroundEvidenceOffset(fractionalDate, RECORDING_START)).toBe(1);
            expect(calculateCodeContributionOffset(fractionalTs, RECORDING_START)).toBe(1);
            expect(calculateIterationOffset(fractionalTs, RECORDING_START).videoOffset).toBe(1);
            expect(calculatePasteChapterOffset(fractionalMs, RECORDING_START).videoOffset).toBe(1);
            expect(calculateAnswerEvidenceOffset(fractionalTs, RECORDING_START)).toBe(1);
        });
    });
});
