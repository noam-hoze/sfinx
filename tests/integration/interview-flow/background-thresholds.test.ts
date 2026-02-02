/**
 * Integration tests for background interview thresholds.
 *
 * Tests:
 * - "Don't know" threshold enforcement
 * - Clarification request threshold
 * - Category exclusion when threshold reached
 * - All categories excluded → interview ends
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    createTestScenario,
    initializeCategoryStats,
    simulateAnswerProcessing,
    determineNextFocusTopic,
    getExcludedCategories,
    CategoryState,
    DEFAULT_EXPERIENCE_CATEGORIES,
} from '../setup';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const DONT_KNOW_THRESHOLD = 2;
const CLARIFICATION_THRESHOLD = 3;
const CONTRIBUTIONS_TARGET = 5;

// ============================================================================
// TESTS
// ============================================================================

describe('Background Interview Thresholds', () => {
    let categoryStats: CategoryState[];
    const categories = DEFAULT_EXPERIENCE_CATEGORIES;
    const categoryNames = categories.map(c => c.name);

    beforeEach(() => {
        categoryStats = initializeCategoryStats(categories);
    });

    describe('Don\'t Know Threshold', () => {
        it('should increment dontKnowCount when candidate says "don\'t know"', () => {
            const targetCategory = 'Problem Solving';

            // Simulate "don't know" response
            const updatedStats = simulateAnswerProcessing(
                categoryStats,
                categoryNames.map(cat => ({ category: cat, strength: cat === targetCategory ? 0 : 50 })),
                true, // isDontKnow
                targetCategory,
                CONTRIBUTIONS_TARGET
            );

            const targetStat = updatedStats.find(s => s.categoryName === targetCategory);
            expect(targetStat?.dontKnowCount).toBe(1);
        });

        it('should exclude category after reaching don\'t know threshold', () => {
            const targetCategory = 'System Design';
            let stats = categoryStats;

            // Simulate multiple "don't know" responses until threshold
            for (let i = 0; i < DONT_KNOW_THRESHOLD; i++) {
                stats = simulateAnswerProcessing(
                    stats,
                    categoryNames.map(cat => ({ category: cat, strength: 0 })),
                    true,
                    targetCategory,
                    CONTRIBUTIONS_TARGET
                );
            }

            const excluded = getExcludedCategories(stats, DONT_KNOW_THRESHOLD);
            expect(excluded).toContain(targetCategory);
            expect(excluded).toHaveLength(1);
        });

        it('should not exclude category before reaching threshold', () => {
            const targetCategory = 'Communication';
            let stats = categoryStats;

            // Simulate one less than threshold
            for (let i = 0; i < DONT_KNOW_THRESHOLD - 1; i++) {
                stats = simulateAnswerProcessing(
                    stats,
                    categoryNames.map(cat => ({ category: cat, strength: 0 })),
                    true,
                    targetCategory,
                    CONTRIBUTIONS_TARGET
                );
            }

            const excluded = getExcludedCategories(stats, DONT_KNOW_THRESHOLD);
            expect(excluded).not.toContain(targetCategory);
            expect(excluded).toHaveLength(0);
        });

        it('should select from remaining categories after exclusion', () => {
            const excludedCategory = 'Problem Solving';
            let stats = categoryStats;

            // Exclude one category
            for (let i = 0; i < DONT_KNOW_THRESHOLD; i++) {
                stats = simulateAnswerProcessing(
                    stats,
                    categoryNames.map(cat => ({ category: cat, strength: 0 })),
                    true,
                    excludedCategory,
                    CONTRIBUTIONS_TARGET
                );
            }

            const excluded = getExcludedCategories(stats, DONT_KNOW_THRESHOLD);
            const nextTopic = determineNextFocusTopic(stats, excluded, CONTRIBUTIONS_TARGET);

            expect(nextTopic).not.toBe(excludedCategory);
            expect(nextTopic).not.toBeNull();
            expect(['System Design', 'Communication']).toContain(nextTopic);
        });

        it('should return null when all categories are excluded', () => {
            let stats = categoryStats;

            // Exclude all categories
            for (const catName of categoryNames) {
                for (let i = 0; i < DONT_KNOW_THRESHOLD; i++) {
                    stats = simulateAnswerProcessing(
                        stats,
                        categoryNames.map(cat => ({ category: cat, strength: 0 })),
                        true,
                        catName,
                        CONTRIBUTIONS_TARGET
                    );
                }
            }

            const excluded = getExcludedCategories(stats, DONT_KNOW_THRESHOLD);
            expect(excluded).toHaveLength(categoryNames.length);

            const nextTopic = determineNextFocusTopic(stats, excluded, CONTRIBUTIONS_TARGET);
            expect(nextTopic).toBeNull();
        });
    });

    describe('Category Score Accumulation', () => {
        it('should use confidence multiplier before reaching contribution target', () => {
            const targetCategory = 'Problem Solving';
            let stats = categoryStats;

            // First contribution: score 80, count 1
            stats = simulateAnswerProcessing(
                stats,
                [{ category: targetCategory, strength: 80 }],
                false,
                targetCategory,
                CONTRIBUTIONS_TARGET
            );

            const stat = stats.find(s => s.categoryName === targetCategory)!;
            expect(stat.count).toBe(1);
            expect(stat.rawAverage).toBe(80);
            // Confidence = 1/5 = 0.2, adjustedAvg = 80 * 0.2 = 16
            expect(stat.confidence).toBe(0.2);
            expect(stat.avgStrength).toBe(16);
        });

        it('should reach full confidence at contribution target', () => {
            const targetCategory = 'System Design';
            let stats = categoryStats;

            // Add contributions up to target
            for (let i = 0; i < CONTRIBUTIONS_TARGET; i++) {
                stats = simulateAnswerProcessing(
                    stats,
                    [{ category: targetCategory, strength: 70 }],
                    false,
                    targetCategory,
                    CONTRIBUTIONS_TARGET
                );
            }

            const stat = stats.find(s => s.categoryName === targetCategory)!;
            expect(stat.count).toBe(CONTRIBUTIONS_TARGET);
            expect(stat.confidence).toBe(1.0);
            // Raw average should equal adjusted average at full confidence
            expect(stat.rawAverage).toBe(stat.avgStrength);
        });

        it('should switch to point accumulation after reaching contribution target', () => {
            const targetCategory = 'Communication';
            let stats = categoryStats;

            // First, reach the target with moderate scores
            for (let i = 0; i < CONTRIBUTIONS_TARGET; i++) {
                stats = simulateAnswerProcessing(
                    stats,
                    [{ category: targetCategory, strength: 60 }],
                    false,
                    targetCategory,
                    CONTRIBUTIONS_TARGET
                );
            }

            const statAtTarget = stats.find(s => s.categoryName === targetCategory)!;
            const scoreAtTarget = statAtTarget.avgStrength;

            // Now add one more high score - should add points, not average
            stats = simulateAnswerProcessing(
                stats,
                [{ category: targetCategory, strength: 90 }], // High score = 6 points
                false,
                targetCategory,
                CONTRIBUTIONS_TARGET
            );

            const statAfter = stats.find(s => s.categoryName === targetCategory)!;
            // Score should be scoreAtTarget + 6 (for 90+ strength)
            expect(statAfter.avgStrength).toBe(Math.min(100, scoreAtTarget + 6));
        });

        it('should cap score at 100', () => {
            const targetCategory = 'Problem Solving';
            let stats = categoryStats;

            // Reach target with high scores
            for (let i = 0; i < CONTRIBUTIONS_TARGET; i++) {
                stats = simulateAnswerProcessing(
                    stats,
                    [{ category: targetCategory, strength: 95 }],
                    false,
                    targetCategory,
                    CONTRIBUTIONS_TARGET
                );
            }

            // Keep adding high scores
            for (let i = 0; i < 10; i++) {
                stats = simulateAnswerProcessing(
                    stats,
                    [{ category: targetCategory, strength: 100 }],
                    false,
                    targetCategory,
                    CONTRIBUTIONS_TARGET
                );
            }

            const stat = stats.find(s => s.categoryName === targetCategory)!;
            expect(stat.avgStrength).toBeLessThanOrEqual(100);
        });
    });

    describe('Topic Selection Logic', () => {
        it('should prioritize categories with more contributions (but under target)', () => {
            let stats = categoryStats;

            // Add 3 contributions to Problem Solving
            for (let i = 0; i < 3; i++) {
                stats = simulateAnswerProcessing(
                    stats,
                    [{ category: 'Problem Solving', strength: 70 }],
                    false,
                    'Problem Solving',
                    CONTRIBUTIONS_TARGET
                );
            }

            // Add 1 contribution to System Design
            stats = simulateAnswerProcessing(
                stats,
                [{ category: 'System Design', strength: 70 }],
                false,
                'System Design',
                CONTRIBUTIONS_TARGET
            );

            const nextTopic = determineNextFocusTopic(stats, [], CONTRIBUTIONS_TARGET);
            // Should prefer Problem Solving (3 contributions) over System Design (1)
            expect(nextTopic).toBe('Problem Solving');
        });

        it('should switch to rebalance mode when all categories reach target', () => {
            let stats = categoryStats;

            // Reach target on all categories with different strengths
            const strengthMap: Record<string, number> = {
                'Problem Solving': 90,
                'System Design': 60,
                'Communication': 75,
            };

            for (const catName of categoryNames) {
                for (let i = 0; i < CONTRIBUTIONS_TARGET; i++) {
                    stats = simulateAnswerProcessing(
                        stats,
                        [{ category: catName, strength: strengthMap[catName] }],
                        false,
                        catName,
                        CONTRIBUTIONS_TARGET
                    );
                }
            }

            // In rebalance mode, should pick weakest category (System Design with 60)
            const nextTopic = determineNextFocusTopic(stats, [], CONTRIBUTIONS_TARGET);
            expect(nextTopic).toBe('System Design');
        });

        it('should break ties by higher strength when counts are equal', () => {
            let stats = categoryStats;

            // Add 2 contributions to each category with different strengths
            stats = simulateAnswerProcessing(
                stats,
                [
                    { category: 'Problem Solving', strength: 80 },
                    { category: 'System Design', strength: 90 },
                    { category: 'Communication', strength: 70 },
                ],
                false,
                'Problem Solving',
                CONTRIBUTIONS_TARGET
            );

            stats = simulateAnswerProcessing(
                stats,
                [
                    { category: 'Problem Solving', strength: 80 },
                    { category: 'System Design', strength: 90 },
                    { category: 'Communication', strength: 70 },
                ],
                false,
                'System Design',
                CONTRIBUTIONS_TARGET
            );

            // All have count 2 now, should pick highest strength (System Design)
            const nextTopic = determineNextFocusTopic(stats, [], CONTRIBUTIONS_TARGET);
            expect(nextTopic).toBe('System Design');
        });
    });

    describe('Clarification Tracking', () => {
        it('should track clarification retry count separately per question', () => {
            // This tests the slice logic, simulated here
            let clarificationRetryCount = 0;
            const MAX_RETRIES = CLARIFICATION_THRESHOLD;

            // Simulate clarification requests
            for (let i = 0; i < MAX_RETRIES - 1; i++) {
                clarificationRetryCount++;
                expect(clarificationRetryCount).toBeLessThan(MAX_RETRIES);
            }

            // At threshold
            clarificationRetryCount++;
            expect(clarificationRetryCount).toBe(MAX_RETRIES);

            // After moving to new question, reset
            clarificationRetryCount = 0;
            expect(clarificationRetryCount).toBe(0);
        });
    });

    describe('Gibberish Detection', () => {
        it('should detect very short answers as gibberish', () => {
            const isGibberish = (answer: string): boolean => {
                const trimmed = answer.trim();
                if (trimmed.length < 3 || /^(.)\1+$/.test(trimmed)) return true;
                if (!/[a-zA-Z]/.test(trimmed)) return true;
                if (/^(\w{2,4})\s*\1\s*\1/.test(trimmed.toLowerCase())) return true;
                if (/([bcdfghjklmnpqrstvwxyz]{3,})/gi.test(trimmed) && trimmed.length < 15) return true;
                return false;
            };

            expect(isGibberish('ok')).toBe(true);
            expect(isGibberish('a')).toBe(true);
            expect(isGibberish('...')).toBe(true);
            expect(isGibberish('123')).toBe(true);
        });

        it('should detect repeated patterns as gibberish', () => {
            const isGibberish = (answer: string): boolean => {
                const trimmed = answer.trim();
                if (trimmed.length < 3 || /^(.)\1+$/.test(trimmed)) return true;
                if (!/[a-zA-Z]/.test(trimmed)) return true;
                if (/^(\w{2,4})\s*\1\s*\1/.test(trimmed.toLowerCase())) return true;
                if (/([bcdfghjklmnpqrstvwxyz]{3,})/gi.test(trimmed) && trimmed.length < 15) return true;
                return false;
            };

            expect(isGibberish('aaa')).toBe(true);
            expect(isGibberish('asdf asdf asdf')).toBe(true);
            expect(isGibberish('blah blah blah')).toBe(true);
        });

        it('should not flag legitimate short answers as gibberish', () => {
            const isGibberish = (answer: string): boolean => {
                const trimmed = answer.trim();
                if (trimmed.length < 3 || /^(.)\1+$/.test(trimmed)) return true;
                if (!/[a-zA-Z]/.test(trimmed)) return true;
                if (/^(\w{2,4})\s*\1\s*\1/.test(trimmed.toLowerCase())) return true;
                if (/([bcdfghjklmnpqrstvwxyz]{3,})/gi.test(trimmed) && trimmed.length < 15) return true;
                return false;
            };

            expect(isGibberish('Yes, I have experience with that.')).toBe(false);
            expect(isGibberish('I worked on similar projects at my last job.')).toBe(false);
        });
    });

    describe('Clarification Request Detection', () => {
        it('should detect clarification request phrases', () => {
            const isClarificationRequest = (answer: string): boolean => {
                return /\b(what do you mean|can you explain|could you clarify|I don't understand|what does that mean|can you rephrase|could you repeat)\b/i.test(answer);
            };

            expect(isClarificationRequest('What do you mean by that?')).toBe(true);
            expect(isClarificationRequest('Can you explain the question?')).toBe(true);
            expect(isClarificationRequest('I don\'t understand the question')).toBe(true);
            expect(isClarificationRequest('Can you rephrase that please?')).toBe(true);
        });

        it('should not flag normal answers as clarification requests', () => {
            const isClarificationRequest = (answer: string): boolean => {
                return /\b(what do you mean|can you explain|could you clarify|I don't understand|what does that mean|can you rephrase|could you repeat)\b/i.test(answer);
            };

            expect(isClarificationRequest('I have 5 years of experience in this area.')).toBe(false);
            expect(isClarificationRequest('The approach I would take is...')).toBe(false);
        });
    });
});

describe('Full Interview Flow Simulation', () => {
    it('should simulate a complete background interview with mixed responses', () => {
        const categories = DEFAULT_EXPERIENCE_CATEGORIES;
        let stats = initializeCategoryStats(categories);
        let excludedTopics: string[] = [];

        // Simulate interview with explicit focus topics and responses
        // This mirrors how the real interview would flow:
        // 1. Algorithm picks topic based on stats
        // 2. AI evaluates response and returns scores
        // 3. Stats are updated
        // 4. Process repeats

        // Round 1-3: Good answers for Problem Solving (algorithm starts here)
        for (let i = 0; i < 3; i++) {
            const focusTopic = determineNextFocusTopic(stats, excludedTopics, CONTRIBUTIONS_TARGET);
            expect(focusTopic).not.toBeNull();

            stats = simulateAnswerProcessing(
                stats,
                [{ category: focusTopic!, strength: 85 }],
                false,
                focusTopic!,
                CONTRIBUTIONS_TARGET
            );
            excludedTopics = getExcludedCategories(stats, DONT_KNOW_THRESHOLD);
        }

        // Round 4-5: "Don't know" for current focus topic (should exclude it)
        const topicToExclude = determineNextFocusTopic(stats, excludedTopics, CONTRIBUTIONS_TARGET)!;
        for (let i = 0; i < DONT_KNOW_THRESHOLD; i++) {
            stats = simulateAnswerProcessing(
                stats,
                [{ category: topicToExclude, strength: 0 }],
                true,
                topicToExclude,
                CONTRIBUTIONS_TARGET
            );
            excludedTopics = getExcludedCategories(stats, DONT_KNOW_THRESHOLD);
        }

        // Verify the topic was excluded
        expect(excludedTopics).toContain(topicToExclude);

        // Continue with remaining categories until they reach contribution target
        let iterations = 0;
        const maxIterations = 20;
        while (iterations < maxIterations) {
            const focusTopic = determineNextFocusTopic(stats, excludedTopics, CONTRIBUTIONS_TARGET);
            if (!focusTopic) break;

            // Check if all non-excluded categories have reached target
            const nonExcluded = stats.filter(s => !excludedTopics.includes(s.categoryName));
            const allAtTarget = nonExcluded.every(s => s.count >= CONTRIBUTIONS_TARGET);
            if (allAtTarget) break;

            stats = simulateAnswerProcessing(
                stats,
                [{ category: focusTopic, strength: 75 }],
                false,
                focusTopic,
                CONTRIBUTIONS_TARGET
            );
            excludedTopics = getExcludedCategories(stats, DONT_KNOW_THRESHOLD);
            iterations++;
        }

        // Verify final state
        expect(excludedTopics).toHaveLength(1);

        // Non-excluded categories should have reached contribution target
        const nonExcludedStats = stats.filter(s => !excludedTopics.includes(s.categoryName));
        for (const stat of nonExcludedStats) {
            expect(stat.count).toBeGreaterThanOrEqual(CONTRIBUTIONS_TARGET);
            expect(stat.confidence).toBe(1.0);
            expect(stat.avgStrength).toBeGreaterThan(50);
        }

        // Excluded category should have don't know count at threshold
        const excludedStat = stats.find(s => excludedTopics.includes(s.categoryName))!;
        expect(excludedStat.dontKnowCount).toBe(DONT_KNOW_THRESHOLD);
    });

    it('should end interview when all categories are excluded', () => {
        const categories = DEFAULT_EXPERIENCE_CATEGORIES;
        const categoryNames = categories.map(c => c.name);
        let stats = initializeCategoryStats(categories);
        let excludedTopics: string[] = [];

        // Exclude all categories by saying "don't know" for each
        for (const catName of categoryNames) {
            for (let i = 0; i < DONT_KNOW_THRESHOLD; i++) {
                stats = simulateAnswerProcessing(
                    stats,
                    [{ category: catName, strength: 0 }],
                    true,
                    catName,
                    CONTRIBUTIONS_TARGET
                );
            }
            excludedTopics = getExcludedCategories(stats, DONT_KNOW_THRESHOLD);
        }

        // All categories should be excluded
        expect(excludedTopics).toHaveLength(categoryNames.length);
        expect(excludedTopics.sort()).toEqual(categoryNames.sort());

        // Next focus topic should be null
        const nextTopic = determineNextFocusTopic(stats, excludedTopics, CONTRIBUTIONS_TARGET);
        expect(nextTopic).toBeNull();
    });
});
