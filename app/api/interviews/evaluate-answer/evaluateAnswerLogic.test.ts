/**
 * Unit tests for the evaluate-answer scoring logic.
 *
 * The evaluate-answer route contains two critical pure functions:
 * 1. getNormalizedPoints — maps contribution strength to discrete point tiers
 * 2. computeUpdatedCounts — the dual-mode scoring algorithm that drives all
 *    background category scores. MODE 1 uses averaging with a confidence
 *    multiplier (before CONTRIBUTIONS_TARGET). MODE 2 uses point accumulation
 *    (after TARGET is reached).
 *
 * These are replicated here (Pattern B) because they're embedded in the
 * route handler and not exported.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Replicated from evaluate-answer/route.ts lines 212-285
// ---------------------------------------------------------------------------

const CONTRIBUTIONS_TARGET = 5;

function getNormalizedPoints(strength: number): number {
    if (strength === 0) return 0;
    if (strength <= 30) return 1;
    if (strength <= 60) return 3;
    if (strength <= 80) return 5;
    return 6; // 81-100
}

interface CategoryCount {
    categoryName: string;
    count: number;
    avgStrength: number;
    rawAverage?: number;
    confidence?: number;
}

function computeUpdatedCounts(
    experienceCategories: Array<{ name: string }>,
    currentCounts: CategoryCount[],
    evaluations: Array<{ category: string; strength: number }>,
): CategoryCount[] {
    return experienceCategories.map((category) => {
        const existing = currentCounts.find((c) => c.categoryName === category.name);
        const newEval = evaluations.find((e) => e.category === category.name);

        if (!newEval || newEval.strength === 0) {
            return existing || { categoryName: category.name, count: 0, avgStrength: 0 };
        }

        const oldCount = existing?.count || 0;
        const oldAdjustedAvg = existing?.avgStrength || 0;
        const newCount = oldCount + 1;

        const categoryHasFullConfidence = oldCount >= CONTRIBUTIONS_TARGET;

        // MODE 1: Averaging with confidence multiplier
        if (!categoryHasFullConfidence) {
            let oldRawAvg = 0;
            if (oldCount > 0 && oldAdjustedAvg > 0) {
                const oldConfidence = Math.min(1.0, oldCount / CONTRIBUTIONS_TARGET);
                oldRawAvg = oldConfidence > 0 ? oldAdjustedAvg / oldConfidence : oldAdjustedAvg;
            }
            const newRawAvg = (oldRawAvg * oldCount + newEval.strength) / newCount;
            const confidence = Math.min(1.0, newCount / CONTRIBUTIONS_TARGET);
            const adjustedAvg = Math.round(newRawAvg * confidence);

            return {
                categoryName: category.name,
                count: newCount,
                avgStrength: adjustedAvg,
                rawAverage: Math.round(newRawAvg),
                confidence,
            };
        }

        // MODE 2: Point accumulation (cap at 100)
        if (oldAdjustedAvg >= 100) {
            return {
                categoryName: category.name,
                count: newCount,
                avgStrength: 100,
                rawAverage: 100,
                confidence: 1.0,
            };
        }

        const points = getNormalizedPoints(newEval.strength);
        const accumulatedScore = Math.min(100, oldAdjustedAvg + points);

        return {
            categoryName: category.name,
            count: newCount,
            avgStrength: accumulatedScore,
            rawAverage: accumulatedScore,
            confidence: 1.0,
        };
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("evaluate-answer scoring logic", () => {
    describe("getNormalizedPoints", () => {
        it("returns 0 for strength 0", () => {
            expect(getNormalizedPoints(0)).toBe(0);
        });

        it("returns 1 for strength 1-30", () => {
            expect(getNormalizedPoints(1)).toBe(1);
            expect(getNormalizedPoints(15)).toBe(1);
            expect(getNormalizedPoints(30)).toBe(1);
        });

        it("returns 3 for strength 31-60", () => {
            expect(getNormalizedPoints(31)).toBe(3);
            expect(getNormalizedPoints(45)).toBe(3);
            expect(getNormalizedPoints(60)).toBe(3);
        });

        it("returns 5 for strength 61-80", () => {
            expect(getNormalizedPoints(61)).toBe(5);
            expect(getNormalizedPoints(70)).toBe(5);
            expect(getNormalizedPoints(80)).toBe(5);
        });

        it("returns 6 for strength 81-100", () => {
            expect(getNormalizedPoints(81)).toBe(6);
            expect(getNormalizedPoints(90)).toBe(6);
            expect(getNormalizedPoints(100)).toBe(6);
        });
    });

    describe("computeUpdatedCounts", () => {
        // ----- MODE 1: Averaging with confidence multiplier -----

        it("first contribution to empty category (MODE 1)", () => {
            const result = computeUpdatedCounts(
                [{ name: "React" }],
                [], // no existing counts
                [{ category: "React", strength: 70 }],
            );

            // newCount=1, rawAvg=(0*0+70)/1=70, confidence=1/5=0.2, adjusted=round(70*0.2)=14
            expect(result).toHaveLength(1);
            expect(result[0].categoryName).toBe("React");
            expect(result[0].count).toBe(1);
            expect(result[0].avgStrength).toBe(14);
            expect(result[0].rawAverage).toBe(70);
            expect(result[0].confidence).toBe(0.2);
        });

        it("second contribution updates running average (MODE 1)", () => {
            const result = computeUpdatedCounts(
                [{ name: "React" }],
                [{ categoryName: "React", count: 1, avgStrength: 14 }],
                [{ category: "React", strength: 50 }],
            );

            // oldConfidence=1/5=0.2, oldRawAvg=14/0.2=70
            // newRawAvg=(70*1+50)/2=60, confidence=2/5=0.4, adjusted=round(60*0.4)=24
            expect(result[0].count).toBe(2);
            expect(result[0].avgStrength).toBe(24);
            expect(result[0].rawAverage).toBe(60);
            expect(result[0].confidence).toBe(0.4);
        });

        it("strength=0 evaluation causes no change", () => {
            const existing = { categoryName: "React", count: 2, avgStrength: 24 };
            const result = computeUpdatedCounts(
                [{ name: "React" }],
                [existing],
                [{ category: "React", strength: 0 }],
            );

            expect(result[0]).toEqual(existing);
        });

        it("category not in evaluations returns existing unchanged", () => {
            const existing = { categoryName: "React", count: 2, avgStrength: 24 };
            const result = computeUpdatedCounts(
                [{ name: "React" }],
                [existing],
                [], // no evaluations for React
            );

            expect(result[0]).toEqual(existing);
        });

        it("category not in evaluations and no existing returns zero entry", () => {
            const result = computeUpdatedCounts(
                [{ name: "React" }],
                [],
                [],
            );

            expect(result[0]).toEqual({ categoryName: "React", count: 0, avgStrength: 0 });
        });

        // ----- MODE 2: Point accumulation -----

        it("switches to point accumulation at CONTRIBUTIONS_TARGET (MODE 2)", () => {
            const result = computeUpdatedCounts(
                [{ name: "React" }],
                [{ categoryName: "React", count: 5, avgStrength: 60 }], // count=5 = TARGET
                [{ category: "React", strength: 70 }], // 61-80 -> 5 points
            );

            // MODE 2: 60 + 5 = 65
            expect(result[0].count).toBe(6);
            expect(result[0].avgStrength).toBe(65);
            expect(result[0].confidence).toBe(1.0);
        });

        it("caps accumulated score at 100 (MODE 2)", () => {
            const result = computeUpdatedCounts(
                [{ name: "React" }],
                [{ categoryName: "React", count: 10, avgStrength: 98 }],
                [{ category: "React", strength: 90 }], // 81-100 -> 6 points
            );

            // 98 + 6 = 104, capped to 100
            expect(result[0].avgStrength).toBe(100);
        });

        it("already at 100 stays at 100 (MODE 2)", () => {
            const result = computeUpdatedCounts(
                [{ name: "React" }],
                [{ categoryName: "React", count: 15, avgStrength: 100 }],
                [{ category: "React", strength: 85 }],
            );

            expect(result[0].avgStrength).toBe(100);
            expect(result[0].count).toBe(16);
        });

        it("low strength adds only 1 point in accumulation mode", () => {
            const result = computeUpdatedCounts(
                [{ name: "React" }],
                [{ categoryName: "React", count: 5, avgStrength: 50 }],
                [{ category: "React", strength: 20 }], // 1-30 -> 1 point
            );

            expect(result[0].avgStrength).toBe(51);
        });

        // ----- Edge cases -----

        it("empty categories returns empty result", () => {
            const result = computeUpdatedCounts([], [], [{ category: "React", strength: 80 }]);
            expect(result).toEqual([]);
        });

        it("multiple categories updated independently", () => {
            const result = computeUpdatedCounts(
                [{ name: "React" }, { name: "Node.js" }],
                [],
                [
                    { category: "React", strength: 80 },
                    { category: "Node.js", strength: 40 },
                ],
            );

            // React: rawAvg=80, conf=0.2, adj=round(80*0.2)=16
            expect(result[0].avgStrength).toBe(16);
            // Node: rawAvg=40, conf=0.2, adj=round(40*0.2)=8
            expect(result[1].avgStrength).toBe(8);
        });

        it("evaluation for unknown category is ignored", () => {
            const result = computeUpdatedCounts(
                [{ name: "React" }],
                [],
                [{ category: "Vue", strength: 90 }], // Vue not in categories
            );

            // React has no matching eval -> returns zero entry
            expect(result[0]).toEqual({ categoryName: "React", count: 0, avgStrength: 0 });
        });

        it("is deterministic — same inputs produce same output", () => {
            const cats = [{ name: "React" }];
            const counts = [{ categoryName: "React", count: 3, avgStrength: 30 }];
            const evals = [{ category: "React", strength: 75 }];

            const r1 = computeUpdatedCounts(cats, counts, evals);
            const r2 = computeUpdatedCounts(cats, counts, evals);

            expect(r1).toEqual(r2);
        });
    });
});
