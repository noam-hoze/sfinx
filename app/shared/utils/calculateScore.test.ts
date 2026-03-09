/**
 * Unit tests for the calculateScore utility.
 *
 * Bug 3 context: the CPS page was re-calculating scores client-side using
 * different category-matching logic (fuzzy prefix match + redundant scale factor)
 * instead of reading the values already computed by this function on the server.
 * Divergence occurred when category names didn't match exactly.
 *
 * The fix was to expose calculatedExperienceScore / calculatedCodingScore from
 * the telemetry API (which calls this function) and read them directly in CPS.
 * These tests ensure the utility itself is correct and deterministic.
 */

import { describe, it, expect } from "vitest";
import { calculateScore } from "./calculateScore";
import type { RawScores, WorkstyleMetrics, ScoringConfiguration } from "./calculateScore";

const defaultConfig: ScoringConfiguration = {
    aiAssistWeight: 25,
    problemSolvingWeight: 25,
    experienceWeight: 40,
    codingWeight: 60,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExperienceScore(score: number, weight = 1) {
    return { name: "Category", score, weight };
}

function makeCodingScore(score: number, weight = 1) {
    return { name: "Category", score, weight };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calculateScore", () => {
    it("returns all-zero scores for empty arrays with no AI assist", () => {
        const raw: RawScores = { experienceScores: [], categoryScores: [] };
        const ws: WorkstyleMetrics = {};
        const result = calculateScore(raw, ws, defaultConfig);

        expect(result.finalScore).toBe(0);
        expect(result.experienceScore).toBe(0);
        expect(result.codingScore).toBe(0);
        expect(result.normalizedWorkstyle.aiAssist).toBeNull();
    });

    it("computes a simple weighted average for experience categories", () => {
        const raw: RawScores = {
            experienceScores: [
                { name: "A", score: 80, weight: 1 },
                { name: "B", score: 60, weight: 1 },
            ],
            categoryScores: [],
        };
        const ws: WorkstyleMetrics = {};
        const result = calculateScore(raw, ws, defaultConfig);

        // Weighted average: (80*1 + 60*1) / 2 = 70
        expect(result.experienceScore).toBe(70);
    });

    it("respects different weights for experience categories", () => {
        const raw: RawScores = {
            experienceScores: [
                { name: "A", score: 100, weight: 3 },
                { name: "B", score: 0, weight: 1 },
            ],
            categoryScores: [],
        };
        const ws: WorkstyleMetrics = {};
        const result = calculateScore(raw, ws, defaultConfig);

        // (100*3 + 0*1) / 4 = 75
        expect(result.experienceScore).toBe(75);
    });

    it("skips categories with zero weight", () => {
        const raw: RawScores = {
            experienceScores: [
                { name: "A", score: 100, weight: 0 },
                { name: "B", score: 40, weight: 2 },
            ],
            categoryScores: [],
        };
        const ws: WorkstyleMetrics = {};
        const result = calculateScore(raw, ws, defaultConfig);

        // Only B contributes: 40
        expect(result.experienceScore).toBe(40);
    });

    it("includes AI assist in coding score when provided", () => {
        const raw: RawScores = {
            experienceScores: [],
            categoryScores: [makeCodingScore(80)],
        };
        const ws: WorkstyleMetrics = { aiAssistAccountabilityScore: 100 };
        const result = calculateScore(raw, ws, {
            aiAssistWeight: 25,
            problemSolvingWeight: 0,
            experienceWeight: 40,
            codingWeight: 60,
        });

        // categoryContribution = 80 * (100 - 25 - 0) / 100 = 80 * 0.75 = 60
        // aiAssistContribution = 100 * 25 / 100 = 25
        // codingScore = 60 + 25 = 85
        expect(result.codingScore).toBe(85);
        expect(result.normalizedWorkstyle.aiAssist).toBe(100);
    });

    it("omits AI assist from coding score when not provided", () => {
        const raw: RawScores = {
            experienceScores: [],
            categoryScores: [makeCodingScore(80)],
        };
        const ws: WorkstyleMetrics = {};
        const result = calculateScore(raw, ws, {
            aiAssistWeight: 25,
            problemSolvingWeight: 0,
            experienceWeight: 40,
            codingWeight: 60,
        });

        // categoryContribution = 80 * 0.75 = 60, aiAssistContribution = 0
        expect(result.codingScore).toBe(60);
        expect(result.normalizedWorkstyle.aiAssist).toBeNull();
    });

    it("includes problem solving in coding score when provided", () => {
        const raw: RawScores = {
            experienceScores: [],
            categoryScores: [makeCodingScore(80)],
        };
        const ws: WorkstyleMetrics = { problemSolvingScore: 100 };
        const result = calculateScore(raw, ws, {
            aiAssistWeight: 0,
            problemSolvingWeight: 25,
            experienceWeight: 40,
            codingWeight: 60,
        });

        // categoryContribution = 80 * (100 - 0 - 25) / 100 = 80 * 0.75 = 60
        // problemSolvingContribution = 100 * 25 / 100 = 25
        // codingScore = 60 + 25 = 85
        expect(result.codingScore).toBe(85);
        expect(result.normalizedWorkstyle.problemSolving).toBe(100);
    });

    it("omits problem solving contribution when score is undefined", () => {
        const raw: RawScores = {
            experienceScores: [],
            categoryScores: [makeCodingScore(80)],
        };
        const ws: WorkstyleMetrics = {};
        const result = calculateScore(raw, ws, {
            aiAssistWeight: 0,
            problemSolvingWeight: 25,
            experienceWeight: 40,
            codingWeight: 60,
        });

        // categoryContribution = 80 * 0.75 = 60, problemSolvingContribution = 0
        expect(result.codingScore).toBe(60);
        expect(result.normalizedWorkstyle.problemSolving).toBeNull();
    });

    it("combines aiAssist and problemSolving weights correctly", () => {
        const raw: RawScores = {
            experienceScores: [],
            categoryScores: [makeCodingScore(100)],
        };
        const ws: WorkstyleMetrics = { aiAssistAccountabilityScore: 80, problemSolvingScore: 60 };
        const result = calculateScore(raw, ws, {
            aiAssistWeight: 25,
            problemSolvingWeight: 25,
            experienceWeight: 40,
            codingWeight: 60,
        });

        // categoryContribution = 100 * (100 - 25 - 25) / 100 = 100 * 0.5 = 50
        // aiAssistContribution = 80 * 25 / 100 = 20
        // problemSolvingContribution = 60 * 25 / 100 = 15
        // codingScore = 50 + 20 + 15 = 85
        expect(result.codingScore).toBe(85);
        expect(result.normalizedWorkstyle.aiAssist).toBe(80);
        expect(result.normalizedWorkstyle.problemSolving).toBe(60);
    });

    it("computes finalScore as weighted average of experience and coding", () => {
        const raw: RawScores = {
            experienceScores: [makeExperienceScore(50)],
            categoryScores: [makeCodingScore(100)],
        };
        const ws: WorkstyleMetrics = {};
        const config: ScoringConfiguration = {
            aiAssistWeight: 0,
            problemSolvingWeight: 0,
            experienceWeight: 40,
            codingWeight: 60,
        };
        const result = calculateScore(raw, ws, config);

        // codingScore = 100 * (100-0)/100 = 100
        // experienceScore = 50
        // finalScore = (50*40 + 100*60) / 100 = (2000+6000)/100 = 80
        expect(result.experienceScore).toBe(50);
        expect(result.codingScore).toBe(100);
        expect(result.finalScore).toBe(80);
    });

    it("is deterministic — same inputs always produce same output", () => {
        const raw: RawScores = {
            experienceScores: [makeExperienceScore(77, 2), makeExperienceScore(33, 3)],
            categoryScores: [makeCodingScore(90, 1), makeCodingScore(50, 2)],
        };
        const ws: WorkstyleMetrics = { aiAssistAccountabilityScore: 60 };

        const r1 = calculateScore(raw, ws, defaultConfig);
        const r2 = calculateScore(raw, ws, defaultConfig);

        expect(r1.finalScore).toBe(r2.finalScore);
        expect(r1.experienceScore).toBe(r2.experienceScore);
        expect(r1.codingScore).toBe(r2.codingScore);
    });

    it("rounds scores to integers", () => {
        const raw: RawScores = {
            experienceScores: [{ name: "A", score: 33, weight: 1 }, { name: "B", score: 34, weight: 1 }],
            categoryScores: [],
        };
        const ws: WorkstyleMetrics = {};
        const result = calculateScore(raw, ws, defaultConfig);

        expect(Number.isInteger(result.experienceScore)).toBe(true);
        expect(Number.isInteger(result.codingScore)).toBe(true);
        expect(Number.isInteger(result.finalScore)).toBe(true);
    });
});
