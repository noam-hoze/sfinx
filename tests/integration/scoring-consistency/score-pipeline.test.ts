/**
 * Integration tests for the scoring pipeline.
 *
 * Tests:
 * - Score calculation with various inputs
 * - Weighted averages work correctly
 * - AI assist accountability impacts coding score
 * - Final score combines experience and coding correctly
 * - Edge cases: empty categories, zero weights, null values
 */

import { describe, it, expect } from 'vitest';
import { calculateScore, type RawScores, type WorkstyleMetrics, type ScoringConfiguration } from '@/app/shared/utils/calculateScore';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: ScoringConfiguration = {
    aiAssistWeight: 25,
    experienceWeight: 50,
    codingWeight: 50,
};

// ============================================================================
// TESTS
// ============================================================================

describe('Score Calculation Pipeline', () => {
    describe('Experience Score Calculation', () => {
        it('should calculate weighted average of experience scores', () => {
            const rawScores: RawScores = {
                experienceScores: [
                    { name: 'Problem Solving', score: 80, weight: 35 },
                    { name: 'System Design', score: 70, weight: 35 },
                    { name: 'Communication', score: 90, weight: 30 },
                ],
                categoryScores: [],
            };

            const result = calculateScore(rawScores, {}, DEFAULT_CONFIG);

            // Expected: (80*35 + 70*35 + 90*30) / (35+35+30) = (2800 + 2450 + 2700) / 100 = 79.5 → 80
            expect(result.experienceScore).toBe(80);
        });

        it('should handle single experience category', () => {
            const rawScores: RawScores = {
                experienceScores: [
                    { name: 'Problem Solving', score: 85, weight: 100 },
                ],
                categoryScores: [],
            };

            const result = calculateScore(rawScores, {}, DEFAULT_CONFIG);
            expect(result.experienceScore).toBe(85);
        });

        it('should return 0 for empty experience scores', () => {
            const rawScores: RawScores = {
                experienceScores: [],
                categoryScores: [],
            };

            const result = calculateScore(rawScores, {}, DEFAULT_CONFIG);
            expect(result.experienceScore).toBe(0);
        });

        it('should ignore categories with zero weight', () => {
            const rawScores: RawScores = {
                experienceScores: [
                    { name: 'Problem Solving', score: 80, weight: 50 },
                    { name: 'Ignored Category', score: 20, weight: 0 },
                    { name: 'Communication', score: 90, weight: 50 },
                ],
                categoryScores: [],
            };

            const result = calculateScore(rawScores, {}, DEFAULT_CONFIG);
            // Expected: (80*50 + 90*50) / (50+50) = 8500 / 100 = 85
            expect(result.experienceScore).toBe(85);
        });
    });

    describe('Coding Score Calculation', () => {
        it('should calculate weighted average of coding category scores', () => {
            const rawScores: RawScores = {
                experienceScores: [],
                categoryScores: [
                    { name: 'Code Quality', score: 75, weight: 40 },
                    { name: 'Algorithm Design', score: 85, weight: 35 },
                    { name: 'Testing', score: 70, weight: 25 },
                ],
            };

            const result = calculateScore(rawScores, {}, DEFAULT_CONFIG);

            // Without AI assist (null), only category scores count
            // But AI assist weight is still in denominator
            // (75*40 + 85*35 + 70*25) / (40+35+25+25) = (3000 + 2975 + 1750) / 125 = 7725 / 125 = 61.8 → 62
            expect(result.codingScore).toBe(62);
        });

        it('should include AI assist accountability in coding score when present', () => {
            const rawScores: RawScores = {
                experienceScores: [],
                categoryScores: [
                    { name: 'Code Quality', score: 80, weight: 40 },
                    { name: 'Algorithm Design', score: 80, weight: 35 },
                ],
            };

            const workstyle: WorkstyleMetrics = {
                aiAssistAccountabilityScore: 100, // Perfect accountability
            };

            const result = calculateScore(rawScores, workstyle, DEFAULT_CONFIG);

            // (80*40 + 80*35 + 100*25) / (40+35+25) = (3200 + 2800 + 2500) / 100 = 8500 / 100 = 85
            expect(result.codingScore).toBe(85);
            expect(result.normalizedWorkstyle.aiAssist).toBe(100);
        });

        it('should penalize coding score when AI assist accountability is low', () => {
            const rawScores: RawScores = {
                experienceScores: [],
                categoryScores: [
                    { name: 'Code Quality', score: 80, weight: 40 },
                    { name: 'Algorithm Design', score: 80, weight: 35 },
                ],
            };

            const workstyleHigh: WorkstyleMetrics = { aiAssistAccountabilityScore: 100 };
            const workstyleLow: WorkstyleMetrics = { aiAssistAccountabilityScore: 0 };

            const resultHigh = calculateScore(rawScores, workstyleHigh, DEFAULT_CONFIG);
            const resultLow = calculateScore(rawScores, workstyleLow, DEFAULT_CONFIG);

            expect(resultHigh.codingScore).toBeGreaterThan(resultLow.codingScore);
            // Difference should be significant due to AI assist weight
            expect(resultHigh.codingScore - resultLow.codingScore).toBe(25);
        });

        it('should handle null AI assist score correctly', () => {
            const rawScores: RawScores = {
                experienceScores: [],
                categoryScores: [
                    { name: 'Code Quality', score: 80, weight: 75 },
                ],
            };

            const withAiAssist = calculateScore(rawScores, { aiAssistAccountabilityScore: 80 }, DEFAULT_CONFIG);
            const withoutAiAssist = calculateScore(rawScores, {}, DEFAULT_CONFIG);

            // Both should have AI assist weight in denominator
            // But without score, numerator doesn't include AI assist contribution
            expect(withoutAiAssist.normalizedWorkstyle.aiAssist).toBeNull();
            expect(withAiAssist.normalizedWorkstyle.aiAssist).toBe(80);
        });
    });

    describe('Final Score Calculation', () => {
        it('should combine experience and coding scores with configured weights', () => {
            const rawScores: RawScores = {
                experienceScores: [
                    { name: 'Problem Solving', score: 80, weight: 100 },
                ],
                categoryScores: [
                    { name: 'Code Quality', score: 60, weight: 75 },
                ],
            };

            const result = calculateScore(rawScores, { aiAssistAccountabilityScore: 60 }, DEFAULT_CONFIG);

            // Experience score: 80
            // Coding score: (60*75 + 60*25) / (75+25) = 6000 / 100 = 60
            // Final: (80*50 + 60*50) / 100 = 7000 / 100 = 70
            expect(result.experienceScore).toBe(80);
            expect(result.codingScore).toBe(60);
            expect(result.finalScore).toBe(70);
        });

        it('should respect custom experience/coding weight ratios', () => {
            const rawScores: RawScores = {
                experienceScores: [
                    { name: 'Experience', score: 100, weight: 100 },
                ],
                categoryScores: [
                    { name: 'Coding', score: 0, weight: 100 },
                ],
            };

            // 70/30 split favoring experience
            const configExperienceHeavy: ScoringConfiguration = {
                aiAssistWeight: 0,
                experienceWeight: 70,
                codingWeight: 30,
            };

            const result = calculateScore(rawScores, {}, configExperienceHeavy);

            // Final: (100*70 + 0*30) / 100 = 70
            expect(result.finalScore).toBe(70);
        });

        it('should handle coding-only configuration', () => {
            const rawScores: RawScores = {
                experienceScores: [],
                categoryScores: [
                    { name: 'Coding', score: 90, weight: 100 },
                ],
            };

            const codingOnlyConfig: ScoringConfiguration = {
                aiAssistWeight: 0,
                experienceWeight: 0,
                codingWeight: 100,
            };

            const result = calculateScore(rawScores, {}, codingOnlyConfig);
            expect(result.finalScore).toBe(90);
        });
    });

    describe('Rounding Behavior', () => {
        it('should round scores to nearest integer', () => {
            const rawScores: RawScores = {
                experienceScores: [
                    { name: 'A', score: 33, weight: 33 },
                    { name: 'B', score: 33, weight: 33 },
                    { name: 'C', score: 34, weight: 34 },
                ],
                categoryScores: [],
            };

            const result = calculateScore(rawScores, {}, DEFAULT_CONFIG);
            expect(Number.isInteger(result.experienceScore)).toBe(true);
            expect(Number.isInteger(result.codingScore)).toBe(true);
            expect(Number.isInteger(result.finalScore)).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle all zeros', () => {
            const rawScores: RawScores = {
                experienceScores: [
                    { name: 'A', score: 0, weight: 50 },
                    { name: 'B', score: 0, weight: 50 },
                ],
                categoryScores: [
                    { name: 'C', score: 0, weight: 100 },
                ],
            };

            const result = calculateScore(rawScores, { aiAssistAccountabilityScore: 0 }, DEFAULT_CONFIG);
            expect(result.experienceScore).toBe(0);
            expect(result.codingScore).toBe(0);
            expect(result.finalScore).toBe(0);
        });

        it('should handle perfect scores', () => {
            const rawScores: RawScores = {
                experienceScores: [
                    { name: 'A', score: 100, weight: 50 },
                    { name: 'B', score: 100, weight: 50 },
                ],
                categoryScores: [
                    { name: 'C', score: 100, weight: 100 },
                ],
            };

            const result = calculateScore(rawScores, { aiAssistAccountabilityScore: 100 }, DEFAULT_CONFIG);
            expect(result.experienceScore).toBe(100);
            expect(result.codingScore).toBe(100);
            expect(result.finalScore).toBe(100);
        });

        it('should handle very small weights', () => {
            const rawScores: RawScores = {
                experienceScores: [
                    { name: 'A', score: 90, weight: 1 },
                    { name: 'B', score: 10, weight: 99 },
                ],
                categoryScores: [],
            };

            const result = calculateScore(rawScores, {}, DEFAULT_CONFIG);
            // (90*1 + 10*99) / 100 = (90 + 990) / 100 = 10.8 → 11
            expect(result.experienceScore).toBe(11);
        });
    });
});

describe('Multi-Candidate Score Comparison', () => {
    it('should produce consistent rankings for different candidate profiles', () => {
        const config = DEFAULT_CONFIG;

        // Strong candidate: high scores across the board
        const strongCandidate: RawScores = {
            experienceScores: [
                { name: 'Problem Solving', score: 90, weight: 35 },
                { name: 'System Design', score: 85, weight: 35 },
                { name: 'Communication', score: 88, weight: 30 },
            ],
            categoryScores: [
                { name: 'Code Quality', score: 92, weight: 40 },
                { name: 'Algorithm Design', score: 88, weight: 35 },
                { name: 'Testing', score: 85, weight: 25 },
            ],
        };

        // Average candidate: moderate scores
        const averageCandidate: RawScores = {
            experienceScores: [
                { name: 'Problem Solving', score: 70, weight: 35 },
                { name: 'System Design', score: 65, weight: 35 },
                { name: 'Communication', score: 72, weight: 30 },
            ],
            categoryScores: [
                { name: 'Code Quality', score: 68, weight: 40 },
                { name: 'Algorithm Design', score: 65, weight: 35 },
                { name: 'Testing', score: 60, weight: 25 },
            ],
        };

        // Weak candidate: low scores
        const weakCandidate: RawScores = {
            experienceScores: [
                { name: 'Problem Solving', score: 45, weight: 35 },
                { name: 'System Design', score: 40, weight: 35 },
                { name: 'Communication', score: 50, weight: 30 },
            ],
            categoryScores: [
                { name: 'Code Quality', score: 42, weight: 40 },
                { name: 'Algorithm Design', score: 38, weight: 35 },
                { name: 'Testing', score: 35, weight: 25 },
            ],
        };

        const strongResult = calculateScore(strongCandidate, { aiAssistAccountabilityScore: 95 }, config);
        const averageResult = calculateScore(averageCandidate, { aiAssistAccountabilityScore: 70 }, config);
        const weakResult = calculateScore(weakCandidate, { aiAssistAccountabilityScore: 30 }, config);

        // Rankings should be: strong > average > weak
        expect(strongResult.finalScore).toBeGreaterThan(averageResult.finalScore);
        expect(averageResult.finalScore).toBeGreaterThan(weakResult.finalScore);

        // Verify score ranges are sensible
        expect(strongResult.finalScore).toBeGreaterThanOrEqual(80);
        expect(averageResult.finalScore).toBeGreaterThanOrEqual(50);
        expect(averageResult.finalScore).toBeLessThanOrEqual(75);
        expect(weakResult.finalScore).toBeLessThanOrEqual(50);
    });

    it('should differentiate candidates with similar overall performance but different strengths', () => {
        const config = DEFAULT_CONFIG;

        // Candidate A: Strong experience, weak coding
        const candidateA: RawScores = {
            experienceScores: [
                { name: 'Experience', score: 90, weight: 100 },
            ],
            categoryScores: [
                { name: 'Coding', score: 50, weight: 100 },
            ],
        };

        // Candidate B: Weak experience, strong coding
        const candidateB: RawScores = {
            experienceScores: [
                { name: 'Experience', score: 50, weight: 100 },
            ],
            categoryScores: [
                { name: 'Coding', score: 90, weight: 100 },
            ],
        };

        const resultA = calculateScore(candidateA, { aiAssistAccountabilityScore: 70 }, config);
        const resultB = calculateScore(candidateB, { aiAssistAccountabilityScore: 70 }, config);

        // Component scores should differ significantly
        expect(resultA.experienceScore).toBe(90);
        expect(resultA.codingScore).toBe(54); // (50*100 + 70*25) / 125 = 6750 / 125 = 54

        expect(resultB.experienceScore).toBe(50);
        expect(resultB.codingScore).toBe(86); // (90*100 + 70*25) / 125 = 10750 / 125 = 86

        // Final scores might be similar but components differ
        // A: (90*50 + 54*50) / 100 = 72
        // B: (50*50 + 86*50) / 100 = 68
        expect(resultA.finalScore).toBe(72);
        expect(resultB.finalScore).toBe(68);
    });

    it('should show impact of AI assist accountability on otherwise equal candidates', () => {
        const config = DEFAULT_CONFIG;

        const baseScores: RawScores = {
            experienceScores: [
                { name: 'Experience', score: 75, weight: 100 },
            ],
            categoryScores: [
                { name: 'Coding', score: 75, weight: 100 },
            ],
        };

        // Same base scores, different AI assist accountability
        const candidateHighAccountability = calculateScore(baseScores, { aiAssistAccountabilityScore: 100 }, config);
        const candidateMedAccountability = calculateScore(baseScores, { aiAssistAccountabilityScore: 50 }, config);
        const candidateLowAccountability = calculateScore(baseScores, { aiAssistAccountabilityScore: 0 }, config);

        // Higher accountability should mean higher coding score and final score
        expect(candidateHighAccountability.codingScore).toBeGreaterThan(candidateMedAccountability.codingScore);
        expect(candidateMedAccountability.codingScore).toBeGreaterThan(candidateLowAccountability.codingScore);

        expect(candidateHighAccountability.finalScore).toBeGreaterThan(candidateMedAccountability.finalScore);
        expect(candidateMedAccountability.finalScore).toBeGreaterThan(candidateLowAccountability.finalScore);

        // Experience score should be the same for all (not affected by AI assist)
        expect(candidateHighAccountability.experienceScore).toBe(candidateMedAccountability.experienceScore);
        expect(candidateMedAccountability.experienceScore).toBe(candidateLowAccountability.experienceScore);
    });
});

describe('Score Consistency Verification', () => {
    it('should produce identical scores for identical inputs across multiple calls', () => {
        const rawScores: RawScores = {
            experienceScores: [
                { name: 'A', score: 75, weight: 50 },
                { name: 'B', score: 82, weight: 50 },
            ],
            categoryScores: [
                { name: 'C', score: 68, weight: 60 },
                { name: 'D', score: 91, weight: 40 },
            ],
        };

        const workstyle: WorkstyleMetrics = { aiAssistAccountabilityScore: 77 };

        const results = [];
        for (let i = 0; i < 100; i++) {
            results.push(calculateScore(rawScores, workstyle, DEFAULT_CONFIG));
        }

        // All results should be identical
        const first = results[0];
        for (const result of results) {
            expect(result.finalScore).toBe(first.finalScore);
            expect(result.experienceScore).toBe(first.experienceScore);
            expect(result.codingScore).toBe(first.codingScore);
            expect(result.normalizedWorkstyle.aiAssist).toBe(first.normalizedWorkstyle.aiAssist);
        }
    });

    it('should be deterministic regardless of category order', () => {
        const rawScoresA: RawScores = {
            experienceScores: [
                { name: 'A', score: 80, weight: 30 },
                { name: 'B', score: 70, weight: 40 },
                { name: 'C', score: 90, weight: 30 },
            ],
            categoryScores: [],
        };

        const rawScoresB: RawScores = {
            experienceScores: [
                { name: 'C', score: 90, weight: 30 },
                { name: 'A', score: 80, weight: 30 },
                { name: 'B', score: 70, weight: 40 },
            ],
            categoryScores: [],
        };

        const resultA = calculateScore(rawScoresA, {}, DEFAULT_CONFIG);
        const resultB = calculateScore(rawScoresB, {}, DEFAULT_CONFIG);

        expect(resultA.experienceScore).toBe(resultB.experienceScore);
        expect(resultA.finalScore).toBe(resultB.finalScore);
    });
});
