/**
 * Integration tests for multi-candidate scoring consistency.
 *
 * Tests:
 * - Multiple candidates for the same job
 * - Ranking consistency
 * - Score display consistency across views (simulated)
 * - Edge cases with tied scores
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    createMultipleCandidates,
    mockDb,
    TestScenario,
    MockBackgroundSummary,
    MockCodingSummary,
    generateId,
} from '../setup';
import { calculateScore, type RawScores, type ScoringConfiguration } from '@/app/shared/utils/calculateScore';

// ============================================================================
// TYPES
// ============================================================================

interface CandidateScoreData {
    sessionId: string;
    candidateName: string;
    experienceCategories: Record<string, { score: number; rawAverage: number; confidence: number }>;
    codingCategories: Record<string, { score: number }>;
    aiAssistAccountabilityScore: number | null;
    expectedFinalScore: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create background summary for a candidate
 */
function createBackgroundSummary(
    telemetryDataId: string,
    experienceCategories: Record<string, { score: number; rawAverage: number; confidence: number; evidenceLinks?: Array<{ timestamp: number; caption: string }> }>
): MockBackgroundSummary {
    const summary: MockBackgroundSummary = {
        id: generateId('bgSummary'),
        telemetryDataId,
        executiveSummary: 'Candidate demonstrated strong technical skills.',
        executiveSummaryOneLiner: 'Strong candidate',
        recommendation: 'Recommend for next round',
        experienceCategories,
        conversationJson: {},
        evidenceJson: {},
    };
    mockDb.backgroundSummaries.set(summary.id, summary);
    mockDb.recordOperation('create', 'backgroundSummary', summary);
    return summary;
}

/**
 * Create coding summary for a candidate
 */
function createCodingSummary(
    telemetryDataId: string,
    codeQualityScore: number,
    jobSpecificCategories: Record<string, { score: number; evidenceLinks?: Array<{ timestamp: number; caption: string }> }>
): MockCodingSummary {
    const summary: MockCodingSummary = {
        id: generateId('codeSummary'),
        telemetryDataId,
        executiveSummary: 'Candidate completed the coding challenge.',
        recommendation: 'Good problem-solving approach',
        codeQualityScore,
        codeQualityText: `Code quality score: ${codeQualityScore}`,
        finalCode: '// completed code',
        jobSpecificCategories,
    };
    mockDb.codingSummaries.set(summary.id, summary);
    mockDb.recordOperation('create', 'codingSummary', summary);
    return summary;
}

/**
 * Calculate expected final score using the same algorithm as the app
 */
function calculateExpectedScore(
    experienceCategories: Record<string, { score: number }>,
    codingCategories: Record<string, { score: number }>,
    aiAssistScore: number | null,
    config: ScoringConfiguration
): number {
    const rawScores: RawScores = {
        experienceScores: Object.entries(experienceCategories).map(([name, data]) => ({
            name,
            score: data.score,
            weight: 1, // Equal weights for simplicity
        })),
        categoryScores: Object.entries(codingCategories).map(([name, data]) => ({
            name,
            score: data.score,
            weight: 1,
        })),
    };

    const result = calculateScore(
        rawScores,
        aiAssistScore !== null ? { aiAssistAccountabilityScore: aiAssistScore } : {},
        config
    );

    return result.finalScore;
}

// ============================================================================
// TESTS
// ============================================================================

describe('Multi-Candidate Score Consistency', () => {
    const scoringConfig: ScoringConfiguration = {
        aiAssistWeight: 25,
        experienceWeight: 50,
        codingWeight: 50,
    };

    beforeEach(() => {
        mockDb.reset();
    });

    describe('Candidate Ranking', () => {
        it('should correctly rank 3 candidates with different scores', () => {
            const scenarios = createMultipleCandidates(3);

            const candidateData: CandidateScoreData[] = [
                {
                    sessionId: scenarios[0].session.id,
                    candidateName: 'Strong Candidate',
                    experienceCategories: {
                        'Problem Solving': { score: 90, rawAverage: 90, confidence: 1.0 },
                        'System Design': { score: 85, rawAverage: 85, confidence: 1.0 },
                    },
                    codingCategories: {
                        'Code Quality': { score: 92 },
                        'Algorithm Design': { score: 88 },
                    },
                    aiAssistAccountabilityScore: 100,
                    expectedFinalScore: 0, // Will be calculated
                },
                {
                    sessionId: scenarios[1].session.id,
                    candidateName: 'Average Candidate',
                    experienceCategories: {
                        'Problem Solving': { score: 70, rawAverage: 70, confidence: 1.0 },
                        'System Design': { score: 65, rawAverage: 65, confidence: 1.0 },
                    },
                    codingCategories: {
                        'Code Quality': { score: 68 },
                        'Algorithm Design': { score: 62 },
                    },
                    aiAssistAccountabilityScore: 75,
                    expectedFinalScore: 0,
                },
                {
                    sessionId: scenarios[2].session.id,
                    candidateName: 'Weak Candidate',
                    experienceCategories: {
                        'Problem Solving': { score: 45, rawAverage: 45, confidence: 1.0 },
                        'System Design': { score: 40, rawAverage: 40, confidence: 1.0 },
                    },
                    codingCategories: {
                        'Code Quality': { score: 42 },
                        'Algorithm Design': { score: 38 },
                    },
                    aiAssistAccountabilityScore: 30,
                    expectedFinalScore: 0,
                },
            ];

            // Calculate expected scores and create summaries
            const scores: Array<{ name: string; sessionId: string; finalScore: number }> = [];

            candidateData.forEach((data, index) => {
                const expectedScore = calculateExpectedScore(
                    data.experienceCategories,
                    data.codingCategories,
                    data.aiAssistAccountabilityScore,
                    scoringConfig
                );

                // Create summaries in mock DB
                createBackgroundSummary(scenarios[index].telemetry.id, data.experienceCategories);
                createCodingSummary(
                    scenarios[index].telemetry.id,
                    Math.round((data.codingCategories['Code Quality'].score + data.codingCategories['Algorithm Design'].score) / 2),
                    data.codingCategories
                );

                // Update session with final score
                const session = mockDb.interviewSessions.get(data.sessionId)!;
                session.finalScore = expectedScore;
                session.status = 'COMPLETED';
                mockDb.interviewSessions.set(data.sessionId, session);

                scores.push({
                    name: data.candidateName,
                    sessionId: data.sessionId,
                    finalScore: expectedScore,
                });
            });

            // Sort by score descending
            scores.sort((a, b) => b.finalScore - a.finalScore);

            // Verify ranking
            expect(scores[0].name).toBe('Strong Candidate');
            expect(scores[1].name).toBe('Average Candidate');
            expect(scores[2].name).toBe('Weak Candidate');

            // Verify score gaps
            expect(scores[0].finalScore).toBeGreaterThan(scores[1].finalScore);
            expect(scores[1].finalScore).toBeGreaterThan(scores[2].finalScore);
        });

        it('should handle candidates with identical scores', () => {
            const scenarios = createMultipleCandidates(2);

            // Both candidates have identical scores
            const identicalCategories = {
                'Problem Solving': { score: 75, rawAverage: 75, confidence: 1.0 },
            };
            const identicalCoding = {
                'Code Quality': { score: 75 },
            };

            scenarios.forEach((scenario, index) => {
                createBackgroundSummary(scenario.telemetry.id, identicalCategories);
                createCodingSummary(scenario.telemetry.id, 75, identicalCoding);

                const expectedScore = calculateExpectedScore(
                    identicalCategories,
                    identicalCoding,
                    75,
                    scoringConfig
                );

                const session = mockDb.interviewSessions.get(scenario.session.id)!;
                session.finalScore = expectedScore;
                mockDb.interviewSessions.set(scenario.session.id, session);
            });

            // Get all sessions
            const sessions = Array.from(mockDb.interviewSessions.values())
                .filter(s => scenarios.some(sc => sc.session.id === s.id));

            // Scores should be identical
            expect(sessions[0].finalScore).toBe(sessions[1].finalScore);
        });
    });

    describe('Score Display Consistency', () => {
        it('should store scores that match calculated scores', () => {
            const scenarios = createMultipleCandidates(1);
            const scenario = scenarios[0];

            const experienceCategories = {
                'Problem Solving': { score: 82, rawAverage: 82, confidence: 1.0 },
                'System Design': { score: 78, rawAverage: 78, confidence: 1.0 },
            };
            const codingCategories = {
                'Code Quality': { score: 85 },
            };
            const aiAssistScore = 90;

            // Calculate expected score
            const expectedScore = calculateExpectedScore(
                experienceCategories,
                codingCategories,
                aiAssistScore,
                scoringConfig
            );

            // Create summaries
            createBackgroundSummary(scenario.telemetry.id, experienceCategories);
            createCodingSummary(scenario.telemetry.id, 85, codingCategories);

            // Store final score in session
            const session = mockDb.interviewSessions.get(scenario.session.id)!;
            session.finalScore = expectedScore;
            mockDb.interviewSessions.set(scenario.session.id, session);

            // Verify: if we recalculate from stored summaries, we get same score
            const bgSummary = Array.from(mockDb.backgroundSummaries.values())
                .find(s => s.telemetryDataId === scenario.telemetry.id)!;
            const codeSummary = Array.from(mockDb.codingSummaries.values())
                .find(s => s.telemetryDataId === scenario.telemetry.id)!;

            const recalculatedScore = calculateExpectedScore(
                bgSummary.experienceCategories as Record<string, { score: number }>,
                codeSummary.jobSpecificCategories as Record<string, { score: number }>,
                aiAssistScore,
                scoringConfig
            );

            expect(recalculatedScore).toBe(session.finalScore);
        });

        it('should track score update operations', () => {
            const scenarios = createMultipleCandidates(1);
            const scenario = scenarios[0];

            createBackgroundSummary(scenario.telemetry.id, {
                'Category': { score: 80, rawAverage: 80, confidence: 1.0 },
            });

            const operations = mockDb.getOperations('backgroundSummary', 'create');
            expect(operations.length).toBe(1);
        });
    });

    describe('Dashboard View Simulation', () => {
        it('should provide correct stats for job with multiple candidates', () => {
            const scenarios = createMultipleCandidates(5);
            const jobId = scenarios[0].job.id;

            // Assign different scores to each candidate
            const scores = [95, 75, 65, 55, 45];

            scenarios.forEach((scenario, index) => {
                const session = mockDb.interviewSessions.get(scenario.session.id)!;
                session.finalScore = scores[index];
                session.status = 'COMPLETED';
                mockDb.interviewSessions.set(scenario.session.id, session);
            });

            // Simulate dashboard query: get all sessions for this job
            const allSessions = Array.from(mockDb.interviewSessions.values());
            const jobApplicationIds = scenarios.map(s => s.application.id);
            const jobSessions = allSessions.filter(s =>
                jobApplicationIds.includes(s.applicationId) && s.finalScore !== null
            );

            // Calculate dashboard stats
            const scoresForJob = jobSessions.map(s => s.finalScore!);
            const highestScore = Math.max(...scoresForJob);
            const averageScore = Math.round(scoresForJob.reduce((a, b) => a + b, 0) / scoresForJob.length);
            const interviewedCount = scoresForJob.length;

            expect(highestScore).toBe(95);
            expect(averageScore).toBe(67); // (95+75+65+55+45)/5 = 67
            expect(interviewedCount).toBe(5);
        });

        it('should handle mix of completed and in-progress interviews', () => {
            const scenarios = createMultipleCandidates(4);

            // 2 completed, 2 in progress
            scenarios.forEach((scenario, index) => {
                const session = mockDb.interviewSessions.get(scenario.session.id)!;
                if (index < 2) {
                    session.finalScore = 80 - index * 10; // 80, 70
                    session.status = 'COMPLETED';
                } else {
                    session.finalScore = null;
                    session.status = 'IN_PROGRESS';
                }
                mockDb.interviewSessions.set(scenario.session.id, session);
            });

            // Dashboard should only count completed interviews
            const allSessions = Array.from(mockDb.interviewSessions.values());
            const completedSessions = allSessions.filter(s =>
                s.finalScore !== null && s.status === 'COMPLETED'
            );

            expect(completedSessions.length).toBe(2);

            const scores = completedSessions.map(s => s.finalScore!);
            const highestScore = Math.max(...scores);
            const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

            expect(highestScore).toBe(80);
            expect(averageScore).toBe(75);
        });
    });

    describe('CPS vs Dashboard Score Consistency', () => {
        it('should verify stored finalScore matches calculated score', () => {
            const scenarios = createMultipleCandidates(1);
            const scenario = scenarios[0];

            // This simulates what happens in the real app:
            // 1. Background and coding summaries are created with category scores
            // 2. finalScore is calculated and stored in the session
            // 3. CPS page reads summaries and recalculates score
            // 4. Dashboard reads finalScore from session

            const experienceCategories = {
                'Problem Solving': { score: 85, rawAverage: 85, confidence: 1.0 },
            };
            const codingCategories = {
                'Code Quality': { score: 80 },
            };

            createBackgroundSummary(scenario.telemetry.id, experienceCategories);
            createCodingSummary(scenario.telemetry.id, 80, codingCategories);

            // Calculate and store final score (like coding-summary-update does)
            const calculatedScore = calculateExpectedScore(
                experienceCategories,
                codingCategories,
                100, // Assume full AI assist accountability
                scoringConfig
            );

            const session = mockDb.interviewSessions.get(scenario.session.id)!;
            session.finalScore = calculatedScore;
            mockDb.interviewSessions.set(scenario.session.id, session);

            // CPS page calculation (reads from summaries)
            const bgSummary = Array.from(mockDb.backgroundSummaries.values())
                .find(s => s.telemetryDataId === scenario.telemetry.id)!;
            const codeSummary = Array.from(mockDb.codingSummaries.values())
                .find(s => s.telemetryDataId === scenario.telemetry.id)!;

            const cpsCalculatedScore = calculateExpectedScore(
                bgSummary.experienceCategories as Record<string, { score: number }>,
                codeSummary.jobSpecificCategories as Record<string, { score: number }>,
                100,
                scoringConfig
            );

            // Dashboard reading (reads from session)
            const updatedSession = mockDb.interviewSessions.get(scenario.session.id)!;
            const dashboardScore = updatedSession.finalScore;

            // KEY ASSERTION: These should match
            expect(cpsCalculatedScore).toBe(dashboardScore);
            expect(cpsCalculatedScore).toBe(calculatedScore);
        });

        it('should detect inconsistency when finalScore is stale', () => {
            const scenarios = createMultipleCandidates(1);
            const scenario = scenarios[0];

            // Initial scores
            const initialCategories = {
                'Problem Solving': { score: 70, rawAverage: 70, confidence: 1.0 },
            };
            const initialCoding = {
                'Code Quality': { score: 70 },
            };

            createBackgroundSummary(scenario.telemetry.id, initialCategories);
            createCodingSummary(scenario.telemetry.id, 70, initialCoding);

            // Store initial score
            const initialScore = calculateExpectedScore(
                initialCategories,
                initialCoding,
                70,
                scoringConfig
            );

            const session = mockDb.interviewSessions.get(scenario.session.id)!;
            session.finalScore = initialScore;
            mockDb.interviewSessions.set(scenario.session.id, session);

            // Now update the background summary (simulating a bug where finalScore isn't updated)
            const bgSummary = Array.from(mockDb.backgroundSummaries.values())
                .find(s => s.telemetryDataId === scenario.telemetry.id)!;

            const updatedCategories = {
                'Problem Solving': { score: 90, rawAverage: 90, confidence: 1.0 }, // Higher score
            };
            bgSummary.experienceCategories = updatedCategories;
            mockDb.backgroundSummaries.set(bgSummary.id, bgSummary);

            // CPS would calculate from updated summaries
            const codeSummary = Array.from(mockDb.codingSummaries.values())
                .find(s => s.telemetryDataId === scenario.telemetry.id)!;

            const cpsCalculatedScore = calculateExpectedScore(
                updatedCategories,
                codeSummary.jobSpecificCategories as Record<string, { score: number }>,
                70,
                scoringConfig
            );

            // Dashboard still has old score
            const dashboardScore = mockDb.interviewSessions.get(scenario.session.id)!.finalScore;

            // INCONSISTENCY DETECTED
            expect(cpsCalculatedScore).not.toBe(dashboardScore);
            expect(cpsCalculatedScore).toBeGreaterThan(dashboardScore!);
        });
    });
});
