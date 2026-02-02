/**
 * Integration tests for paste detection and AI assist accountability.
 *
 * Tests:
 * - Paste event detection and tracking
 * - Understanding level evaluation (FULL, PARTIAL, NONE)
 * - Accountability score calculation
 * - Multiple paste events aggregation
 * - Impact on final coding score
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    createTestScenario,
    mockDb,
    MockExternalToolUsage,
    generateId,
} from '../setup';
import { calculateScore, type RawScores, type ScoringConfiguration } from '@/app/shared/utils/calculateScore';

// ============================================================================
// TYPES
// ============================================================================

type UnderstandingLevel = 'FULL' | 'PARTIAL' | 'NONE';

interface PasteEvent {
    pastedContent: string;
    characterCount: number;
    understanding: UnderstandingLevel;
    userAnswer: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate accountability score based on understanding level
 * This mirrors the logic in the paste evaluation endpoint
 */
function calculateAccountabilityScore(understanding: UnderstandingLevel): number {
    switch (understanding) {
        case 'FULL':
            return 100;
        case 'PARTIAL':
            return 50;
        case 'NONE':
            return 0;
    }
}

/**
 * Aggregate multiple paste events into a single AI assist accountability score
 */
function aggregatePasteScores(events: Array<{ understanding: UnderstandingLevel; accountabilityScore: number }>): number {
    if (events.length === 0) return 100; // No pastes = full accountability

    // Simple average of all accountability scores
    const sum = events.reduce((acc, e) => acc + e.accountabilityScore, 0);
    return Math.round(sum / events.length);
}

/**
 * Create a mock ExternalToolUsage record
 */
function createPasteRecord(
    sessionId: string,
    event: PasteEvent,
    questionIndex: number
): MockExternalToolUsage {
    const score = calculateAccountabilityScore(event.understanding);
    const record: MockExternalToolUsage = {
        id: generateId('paste'),
        interviewSessionId: sessionId,
        timestamp: new Date(Date.now() + questionIndex * 60000),
        pastedContent: event.pastedContent,
        characterCount: event.characterCount,
        aiQuestion: `Can you explain what this code does?`,
        aiQuestionTimestamp: new Date(Date.now() + questionIndex * 60000 + 5000),
        userAnswer: event.userAnswer,
        understanding: event.understanding,
        accountabilityScore: score,
        reasoning: `Candidate demonstrated ${event.understanding.toLowerCase()} understanding.`,
        caption: `AI Assist: ${event.understanding} understanding`,
    };
    mockDb.externalToolUsages.set(record.id, record);
    mockDb.recordOperation('create', 'externalToolUsage', record);
    return record;
}

// ============================================================================
// TESTS
// ============================================================================

describe('Paste Detection and Tracking', () => {
    beforeEach(() => {
        mockDb.reset();
    });

    describe('Understanding Level Scoring', () => {
        it('should assign 100 for FULL understanding', () => {
            const score = calculateAccountabilityScore('FULL');
            expect(score).toBe(100);
        });

        it('should assign 50 for PARTIAL understanding', () => {
            const score = calculateAccountabilityScore('PARTIAL');
            expect(score).toBe(50);
        });

        it('should assign 0 for NONE understanding', () => {
            const score = calculateAccountabilityScore('NONE');
            expect(score).toBe(0);
        });
    });

    describe('Single Paste Event', () => {
        it('should record paste event with FULL understanding', () => {
            const scenario = createTestScenario();
            const pasteEvent: PasteEvent = {
                pastedContent: 'function sortArray(arr) { return arr.sort((a, b) => a - b); }',
                characterCount: 55,
                understanding: 'FULL',
                userAnswer: 'This sorts the array in ascending order using a comparison function.',
            };

            const record = createPasteRecord(scenario.session.id, pasteEvent, 0);

            expect(record.understanding).toBe('FULL');
            expect(record.accountabilityScore).toBe(100);
            expect(mockDb.externalToolUsages.size).toBe(1);
        });

        it('should record paste event with PARTIAL understanding', () => {
            const scenario = createTestScenario();
            const pasteEvent: PasteEvent = {
                pastedContent: 'const memoize = (fn) => { const cache = {}; return (...args) => cache[args] || (cache[args] = fn(...args)); }',
                characterCount: 95,
                understanding: 'PARTIAL',
                userAnswer: 'It\'s some kind of caching function, I think it stores results.',
            };

            const record = createPasteRecord(scenario.session.id, pasteEvent, 0);

            expect(record.understanding).toBe('PARTIAL');
            expect(record.accountabilityScore).toBe(50);
        });

        it('should record paste event with NONE understanding', () => {
            const scenario = createTestScenario();
            const pasteEvent: PasteEvent = {
                pastedContent: 'async function* asyncGenerator() { yield await Promise.resolve(1); }',
                characterCount: 68,
                understanding: 'NONE',
                userAnswer: 'I\'m not really sure what this does.',
            };

            const record = createPasteRecord(scenario.session.id, pasteEvent, 0);

            expect(record.understanding).toBe('NONE');
            expect(record.accountabilityScore).toBe(0);
        });
    });

    describe('Multiple Paste Events Aggregation', () => {
        it('should average scores for multiple paste events', () => {
            const events = [
                { understanding: 'FULL' as UnderstandingLevel, accountabilityScore: 100 },
                { understanding: 'PARTIAL' as UnderstandingLevel, accountabilityScore: 50 },
                { understanding: 'FULL' as UnderstandingLevel, accountabilityScore: 100 },
            ];

            const aggregated = aggregatePasteScores(events);
            // (100 + 50 + 100) / 3 = 83.33 → 83
            expect(aggregated).toBe(83);
        });

        it('should return 100 when no paste events occurred', () => {
            const aggregated = aggregatePasteScores([]);
            expect(aggregated).toBe(100);
        });

        it('should handle all NONE understanding', () => {
            const events = [
                { understanding: 'NONE' as UnderstandingLevel, accountabilityScore: 0 },
                { understanding: 'NONE' as UnderstandingLevel, accountabilityScore: 0 },
            ];

            const aggregated = aggregatePasteScores(events);
            expect(aggregated).toBe(0);
        });

        it('should handle mixed understanding levels', () => {
            const events = [
                { understanding: 'FULL' as UnderstandingLevel, accountabilityScore: 100 },
                { understanding: 'PARTIAL' as UnderstandingLevel, accountabilityScore: 50 },
                { understanding: 'NONE' as UnderstandingLevel, accountabilityScore: 0 },
            ];

            const aggregated = aggregatePasteScores(events);
            // (100 + 50 + 0) / 3 = 50
            expect(aggregated).toBe(50);
        });
    });

    describe('Paste Records in Database', () => {
        it('should store multiple paste events for single session', () => {
            const scenario = createTestScenario();

            const pasteEvents: PasteEvent[] = [
                {
                    pastedContent: 'function helper1() {}',
                    characterCount: 22,
                    understanding: 'FULL',
                    userAnswer: 'Empty helper function',
                },
                {
                    pastedContent: 'const complexLogic = (x) => x * 2 + 1',
                    characterCount: 37,
                    understanding: 'PARTIAL',
                    userAnswer: 'It does something with numbers',
                },
                {
                    pastedContent: 'Object.fromEntries(Object.entries(obj).map(([k,v]) => [k, transform(v)]))',
                    characterCount: 74,
                    understanding: 'NONE',
                    userAnswer: 'No idea',
                },
            ];

            pasteEvents.forEach((event, index) => {
                createPasteRecord(scenario.session.id, event, index);
            });

            expect(mockDb.externalToolUsages.size).toBe(3);

            // Verify all records belong to the same session
            const records = Array.from(mockDb.externalToolUsages.values());
            records.forEach(record => {
                expect(record.interviewSessionId).toBe(scenario.session.id);
            });

            // Verify understanding breakdown
            const fullCount = records.filter(r => r.understanding === 'FULL').length;
            const partialCount = records.filter(r => r.understanding === 'PARTIAL').length;
            const noneCount = records.filter(r => r.understanding === 'NONE').length;

            expect(fullCount).toBe(1);
            expect(partialCount).toBe(1);
            expect(noneCount).toBe(1);
        });

        it('should track operations for audit trail', () => {
            const scenario = createTestScenario();

            createPasteRecord(scenario.session.id, {
                pastedContent: 'test code',
                characterCount: 9,
                understanding: 'FULL',
                userAnswer: 'test answer',
            }, 0);

            const operations = mockDb.getOperations('externalToolUsage', 'create');
            expect(operations.length).toBe(1);
        });
    });
});

describe('AI Assist Impact on Final Score', () => {
    const scoringConfig: ScoringConfiguration = {
        aiAssistWeight: 25,
        experienceWeight: 50,
        codingWeight: 50,
    };

    it('should increase coding score with full accountability', () => {
        const baseScores: RawScores = {
            experienceScores: [{ name: 'Exp', score: 70, weight: 100 }],
            categoryScores: [{ name: 'Code', score: 70, weight: 100 }],
        };

        const resultWithFullAccountability = calculateScore(
            baseScores,
            { aiAssistAccountabilityScore: 100 },
            scoringConfig
        );

        const resultWithNoAccountability = calculateScore(
            baseScores,
            { aiAssistAccountabilityScore: 0 },
            scoringConfig
        );

        // Coding score should be higher with full accountability
        expect(resultWithFullAccountability.codingScore).toBeGreaterThan(resultWithNoAccountability.codingScore);

        // Final score should also be higher
        expect(resultWithFullAccountability.finalScore).toBeGreaterThan(resultWithNoAccountability.finalScore);
    });

    it('should not affect experience score', () => {
        const baseScores: RawScores = {
            experienceScores: [{ name: 'Exp', score: 80, weight: 100 }],
            categoryScores: [{ name: 'Code', score: 70, weight: 100 }],
        };

        const resultHigh = calculateScore(baseScores, { aiAssistAccountabilityScore: 100 }, scoringConfig);
        const resultLow = calculateScore(baseScores, { aiAssistAccountabilityScore: 0 }, scoringConfig);

        expect(resultHigh.experienceScore).toBe(80);
        expect(resultLow.experienceScore).toBe(80);
    });

    it('should show proportional impact based on AI assist weight', () => {
        const baseScores: RawScores = {
            experienceScores: [],
            categoryScores: [{ name: 'Code', score: 100, weight: 100 }],
        };

        // With 25% AI assist weight
        const config25: ScoringConfiguration = { aiAssistWeight: 25, experienceWeight: 50, codingWeight: 50 };
        const result25_full = calculateScore(baseScores, { aiAssistAccountabilityScore: 100 }, config25);
        const result25_none = calculateScore(baseScores, { aiAssistAccountabilityScore: 0 }, config25);

        // With 50% AI assist weight
        const config50: ScoringConfiguration = { aiAssistWeight: 50, experienceWeight: 50, codingWeight: 50 };
        const result50_full = calculateScore(baseScores, { aiAssistAccountabilityScore: 100 }, config50);
        const result50_none = calculateScore(baseScores, { aiAssistAccountabilityScore: 0 }, config50);

        // Higher weight should mean bigger difference
        const diff25 = result25_full.codingScore - result25_none.codingScore;
        const diff50 = result50_full.codingScore - result50_none.codingScore;

        expect(diff50).toBeGreaterThan(diff25);
    });
});

describe('Paste-Heavy Candidate Scenarios', () => {
    beforeEach(() => {
        mockDb.reset();
    });

    it('should handle candidate with all FULL understanding pastes', () => {
        const scenario = createTestScenario();

        // 5 paste events, all with FULL understanding
        for (let i = 0; i < 5; i++) {
            createPasteRecord(scenario.session.id, {
                pastedContent: `code snippet ${i}`,
                characterCount: 20,
                understanding: 'FULL',
                userAnswer: `Detailed explanation of code ${i}`,
            }, i);
        }

        const records = Array.from(mockDb.externalToolUsages.values())
            .filter(r => r.interviewSessionId === scenario.session.id);

        const events = records.map(r => ({
            understanding: r.understanding,
            accountabilityScore: r.accountabilityScore,
        }));

        const aggregatedScore = aggregatePasteScores(events);
        expect(aggregatedScore).toBe(100);
    });

    it('should handle candidate with all NONE understanding pastes', () => {
        const scenario = createTestScenario();

        // 5 paste events, all with NONE understanding
        for (let i = 0; i < 5; i++) {
            createPasteRecord(scenario.session.id, {
                pastedContent: `complex code snippet ${i}`,
                characterCount: 50,
                understanding: 'NONE',
                userAnswer: `I don't understand this code`,
            }, i);
        }

        const records = Array.from(mockDb.externalToolUsages.values())
            .filter(r => r.interviewSessionId === scenario.session.id);

        const events = records.map(r => ({
            understanding: r.understanding,
            accountabilityScore: r.accountabilityScore,
        }));

        const aggregatedScore = aggregatePasteScores(events);
        expect(aggregatedScore).toBe(0);

        // Calculate final score impact
        const scoringConfig: ScoringConfiguration = {
            aiAssistWeight: 25,
            experienceWeight: 50,
            codingWeight: 50,
        };

        const baseScores: RawScores = {
            experienceScores: [{ name: 'Exp', score: 80, weight: 100 }],
            categoryScores: [{ name: 'Code', score: 80, weight: 100 }],
        };

        const result = calculateScore(baseScores, { aiAssistAccountabilityScore: aggregatedScore }, scoringConfig);

        // Despite good base scores, AI assist accountability of 0 should hurt
        expect(result.codingScore).toBe(64); // (80*100 + 0*25) / 125 = 64
        expect(result.finalScore).toBe(72); // (80*50 + 64*50) / 100 = 72
    });

    it('should handle realistic mixed scenario', () => {
        const scenario = createTestScenario();

        // Realistic scenario: 1 FULL, 2 PARTIAL, 1 NONE
        const pasteEvents: PasteEvent[] = [
            { pastedContent: 'simple loop', characterCount: 30, understanding: 'FULL', userAnswer: 'Good explanation' },
            { pastedContent: 'sorting algo', characterCount: 80, understanding: 'PARTIAL', userAnswer: 'It sorts...' },
            { pastedContent: 'regex pattern', characterCount: 45, understanding: 'PARTIAL', userAnswer: 'Pattern matching' },
            { pastedContent: 'complex async', characterCount: 120, understanding: 'NONE', userAnswer: 'Not sure' },
        ];

        pasteEvents.forEach((event, index) => {
            createPasteRecord(scenario.session.id, event, index);
        });

        const records = Array.from(mockDb.externalToolUsages.values())
            .filter(r => r.interviewSessionId === scenario.session.id);

        const events = records.map(r => ({
            understanding: r.understanding,
            accountabilityScore: r.accountabilityScore,
        }));

        const aggregatedScore = aggregatePasteScores(events);
        // (100 + 50 + 50 + 0) / 4 = 50
        expect(aggregatedScore).toBe(50);
    });
});
