/**
 * Test data factories for integration tests.
 *
 * Creates realistic test scenarios with properly linked entities.
 */

import {
    mockDb,
    generateId,
    MockUser,
    MockCompany,
    MockJob,
    MockScoringConfiguration,
    MockApplication,
    MockInterviewSession,
    MockTelemetryData,
} from './mockPrisma';

// ============================================================================
// TYPES
// ============================================================================

export interface TestScenarioConfig {
    candidateName?: string;
    candidateEmail?: string;
    companyName?: string;
    jobTitle?: string;
    experienceCategories?: Array<{ name: string; weight: number }>;
    codingCategories?: Array<{ name: string; weight: number }>;
    scoringConfig?: Partial<MockScoringConfiguration>;
}

export interface TestScenario {
    candidate: MockUser;
    company: MockCompany;
    job: MockJob;
    scoringConfig: MockScoringConfiguration;
    application: MockApplication;
    session: MockInterviewSession;
    telemetry: MockTelemetryData;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_EXPERIENCE_CATEGORIES = [
    { name: 'Problem Solving', weight: 35 },
    { name: 'System Design', weight: 35 },
    { name: 'Communication', weight: 30 },
];

export const DEFAULT_CODING_CATEGORIES = [
    { name: 'Code Quality', weight: 40 },
    { name: 'Algorithm Design', weight: 35 },
    { name: 'Testing', weight: 25 },
];

export const DEFAULT_SCORING_CONFIG = {
    aiAssistWeight: 25,
    experienceWeight: 50,
    codingWeight: 50,
};

// ============================================================================
// FACTORIES
// ============================================================================

/**
 * Create a complete test scenario with all linked entities
 */
export function createTestScenario(config: TestScenarioConfig = {}): TestScenario {
    const {
        candidateName = 'Test Candidate',
        candidateEmail = `candidate_${Date.now()}@test.com`,
        companyName = 'Test Company Inc',
        jobTitle = 'Senior Software Engineer',
        experienceCategories = DEFAULT_EXPERIENCE_CATEGORIES,
        codingCategories = DEFAULT_CODING_CATEGORIES,
        scoringConfig = DEFAULT_SCORING_CONFIG,
    } = config;

    // Create candidate
    const candidate: MockUser = {
        id: generateId('user'),
        name: candidateName,
        email: candidateEmail,
        role: 'CANDIDATE',
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    mockDb.users.set(candidate.id, candidate);

    // Create company
    const company: MockCompany = {
        id: generateId('company'),
        name: companyName,
        industry: 'Technology',
        size: 'MEDIUM',
    };
    mockDb.companies.set(company.id, company);

    // Create job
    const job: MockJob = {
        id: generateId('job'),
        title: jobTitle,
        type: 'FULL_TIME',
        companyId: company.id,
        experienceCategories,
        codingCategories,
    };
    mockDb.jobs.set(job.id, job);

    // Create scoring configuration
    const scoring: MockScoringConfiguration = {
        id: generateId('scoring'),
        jobId: job.id,
        aiAssistWeight: scoringConfig.aiAssistWeight ?? DEFAULT_SCORING_CONFIG.aiAssistWeight,
        experienceWeight: scoringConfig.experienceWeight ?? DEFAULT_SCORING_CONFIG.experienceWeight,
        codingWeight: scoringConfig.codingWeight ?? DEFAULT_SCORING_CONFIG.codingWeight,
    };
    mockDb.scoringConfigurations.set(scoring.id, scoring);

    // Create application
    const application: MockApplication = {
        id: generateId('application'),
        candidateId: candidate.id,
        jobId: job.id,
        status: 'INTERVIEWING',
    };
    mockDb.applications.set(application.id, application);

    // Create interview session
    const session: MockInterviewSession = {
        id: generateId('session'),
        candidateId: candidate.id,
        applicationId: application.id,
        videoUrl: null,
        recordingStartedAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
        duration: null,
        status: 'IN_PROGRESS',
        finalScore: null,
    };
    mockDb.interviewSessions.set(session.id, session);

    // Create telemetry data
    const telemetry: MockTelemetryData = {
        id: generateId('telemetry'),
        interviewSessionId: session.id,
        matchScore: 0,
        confidence: 'MEDIUM',
        story: '',
    };
    mockDb.telemetryData.set(telemetry.id, telemetry);

    return {
        candidate,
        company,
        job,
        scoringConfig: scoring,
        application,
        session,
        telemetry,
    };
}

/**
 * Create multiple test scenarios for multi-candidate testing
 */
export function createMultipleCandidates(
    count: number,
    baseConfig: TestScenarioConfig = {}
): TestScenario[] {
    const scenarios: TestScenario[] = [];

    // Create shared company and job
    const company: MockCompany = {
        id: generateId('company'),
        name: baseConfig.companyName || 'Test Company Inc',
        industry: 'Technology',
        size: 'MEDIUM',
    };
    mockDb.companies.set(company.id, company);

    const job: MockJob = {
        id: generateId('job'),
        title: baseConfig.jobTitle || 'Senior Software Engineer',
        type: 'FULL_TIME',
        companyId: company.id,
        experienceCategories: baseConfig.experienceCategories || DEFAULT_EXPERIENCE_CATEGORIES,
        codingCategories: baseConfig.codingCategories || DEFAULT_CODING_CATEGORIES,
    };
    mockDb.jobs.set(job.id, job);

    const scoring: MockScoringConfiguration = {
        id: generateId('scoring'),
        jobId: job.id,
        aiAssistWeight: baseConfig.scoringConfig?.aiAssistWeight ?? DEFAULT_SCORING_CONFIG.aiAssistWeight,
        experienceWeight: baseConfig.scoringConfig?.experienceWeight ?? DEFAULT_SCORING_CONFIG.experienceWeight,
        codingWeight: baseConfig.scoringConfig?.codingWeight ?? DEFAULT_SCORING_CONFIG.codingWeight,
    };
    mockDb.scoringConfigurations.set(scoring.id, scoring);

    for (let i = 0; i < count; i++) {
        const candidate: MockUser = {
            id: generateId('user'),
            name: `Candidate ${i + 1}`,
            email: `candidate${i + 1}_${Date.now()}@test.com`,
            role: 'CANDIDATE',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        mockDb.users.set(candidate.id, candidate);

        const application: MockApplication = {
            id: generateId('application'),
            candidateId: candidate.id,
            jobId: job.id,
            status: 'INTERVIEWING',
        };
        mockDb.applications.set(application.id, application);

        const session: MockInterviewSession = {
            id: generateId('session'),
            candidateId: candidate.id,
            applicationId: application.id,
            videoUrl: null,
            recordingStartedAt: new Date(),
            startedAt: new Date(),
            completedAt: null,
            duration: null,
            status: 'IN_PROGRESS',
            finalScore: null,
        };
        mockDb.interviewSessions.set(session.id, session);

        const telemetry: MockTelemetryData = {
            id: generateId('telemetry'),
            interviewSessionId: session.id,
            matchScore: 0,
            confidence: 'MEDIUM',
            story: '',
        };
        mockDb.telemetryData.set(telemetry.id, telemetry);

        scenarios.push({
            candidate,
            company,
            job,
            scoringConfig: scoring,
            application,
            session,
            telemetry,
        });
    }

    return scenarios;
}

// ============================================================================
// INTERVIEW STATE SIMULATION
// ============================================================================

export interface CategoryState {
    categoryName: string;
    count: number;
    avgStrength: number;
    rawAverage?: number;
    confidence?: number;
    dontKnowCount: number;
}

/**
 * Initialize category stats for an interview
 */
export function initializeCategoryStats(
    categories: Array<{ name: string; weight: number }>
): CategoryState[] {
    return categories.map(cat => ({
        categoryName: cat.name,
        count: 0,
        avgStrength: 0,
        rawAverage: 0,
        confidence: 0,
        dontKnowCount: 0,
    }));
}

/**
 * Simulate processing an answer and updating category stats
 * This mirrors the logic in evaluate-answer-fast
 */
export function simulateAnswerProcessing(
    currentStats: CategoryState[],
    scores: Array<{ category: string; strength: number }>,
    isDontKnow: boolean,
    focusedCategory: string,
    contributionsTarget: number = 5
): CategoryState[] {
    // First, increment don't know if applicable
    let statsWithDontKnow = currentStats;
    if (isDontKnow) {
        statsWithDontKnow = currentStats.map(stat => {
            if (stat.categoryName === focusedCategory) {
                return { ...stat, dontKnowCount: stat.dontKnowCount + 1 };
            }
            return stat;
        });
    }

    // Helper: Map contribution strength to normalized points
    const getNormalizedPoints = (strength: number): number => {
        if (strength === 0) return 0;
        if (strength <= 30) return 1;
        if (strength <= 60) return 3;
        if (strength <= 80) return 5;
        return 6; // 81-100
    };

    // Update stats based on scores
    return statsWithDontKnow.map(stat => {
        const score = scores.find(s => s.category === stat.categoryName);
        if (!score || score.strength === 0) {
            return stat;
        }

        const oldCount = stat.count;
        const oldAdjustedAvg = stat.avgStrength;
        const newCount = oldCount + 1;

        // Check if THIS category has reached full confidence
        const categoryHasFullConfidence = oldCount >= contributionsTarget;

        // MODE 1: Averaging with confidence multiplier (before this category reaches full confidence)
        if (!categoryHasFullConfidence) {
            // Back-calculate raw average from adjusted (adjusted = raw * confidence)
            let oldRawAvg = 0;
            if (oldCount > 0 && oldAdjustedAvg > 0) {
                const oldConfidence = Math.min(1.0, oldCount / contributionsTarget);
                oldRawAvg = oldConfidence > 0 ? oldAdjustedAvg / oldConfidence : oldAdjustedAvg;
            }

            // Calculate new raw average
            const newRawAvg = (oldRawAvg * oldCount + score.strength) / newCount;

            // Apply confidence multiplier based on sample size
            const confidence = Math.min(1.0, newCount / contributionsTarget);
            const adjustedAvg = Math.round(newRawAvg * confidence);

            return {
                categoryName: stat.categoryName,
                count: newCount,
                avgStrength: adjustedAvg,
                rawAverage: Math.round(newRawAvg),
                confidence: confidence,
                dontKnowCount: stat.dontKnowCount,
            };
        }

        // MODE 2: Point accumulation (after THIS category reaches full confidence)
        // Cap at 100 - once reached, no more points added
        if (oldAdjustedAvg >= 100) {
            return {
                categoryName: stat.categoryName,
                count: newCount,
                avgStrength: 100,
                rawAverage: 100,
                confidence: 1.0,
                dontKnowCount: stat.dontKnowCount,
            };
        }

        const points = getNormalizedPoints(score.strength);
        const accumulatedScore = Math.min(100, oldAdjustedAvg + points);

        return {
            categoryName: stat.categoryName,
            count: newCount,
            avgStrength: accumulatedScore,
            rawAverage: accumulatedScore,
            confidence: 1.0,
            dontKnowCount: stat.dontKnowCount,
        };
    });
}

/**
 * Determine next focus topic based on current stats
 */
export function determineNextFocusTopic(
    stats: CategoryState[],
    excludedTopics: string[],
    contributionsTarget: number = 5
): string | null {
    const activeStats = stats.filter(s => !excludedTopics.includes(s.categoryName));

    if (activeStats.length === 0) {
        return null; // All categories excluded
    }

    // Partition: active (count < TARGET) vs inactive (count >= TARGET)
    const active = activeStats.filter(s => s.count < contributionsTarget);

    if (active.length > 0) {
        // MODE 1: Contribution collection - prefer higher count, tie-break by higher strength
        active.sort((a, b) => b.count - a.count || b.avgStrength - a.avgStrength);
        return active[0].categoryName;
    } else {
        // MODE 2: Rebalance - pick weakest category (lowest avgStrength)
        activeStats.sort((a, b) => a.avgStrength - b.avgStrength);
        return activeStats[0].categoryName;
    }
}

/**
 * Check if a category should be excluded based on don't know threshold
 */
export function shouldExcludeCategory(
    stats: CategoryState,
    threshold: number
): boolean {
    return stats.dontKnowCount >= threshold;
}

/**
 * Get all categories that should be excluded
 */
export function getExcludedCategories(
    stats: CategoryState[],
    threshold: number
): string[] {
    return stats
        .filter(s => shouldExcludeCategory(s, threshold))
        .map(s => s.categoryName);
}

// ============================================================================
// SCORE CALCULATION
// ============================================================================

export interface CalculatedScores {
    finalScore: number;
    experienceScore: number;
    codingScore: number;
    aiAssistScore: number | null;
}

/**
 * Calculate final scores from category stats
 * Mirrors the calculateScore utility
 */
export function calculateExpectedScores(
    experienceStats: CategoryState[],
    codingStats: CategoryState[],
    aiAssistAccountabilityScore: number | null,
    scoringConfig: MockScoringConfiguration
): CalculatedScores {
    // Get category weights from job config (would need to be passed in)
    // For now, using equal weights within each category group

    // Calculate experience score (weighted average)
    let experienceWeightedSum = 0;
    let totalExperienceWeight = 0;
    experienceStats.forEach(stat => {
        // Using equal weights for simplicity - in real scenario, get from job config
        const weight = 1;
        if (stat.avgStrength > 0) {
            experienceWeightedSum += stat.avgStrength * weight;
            totalExperienceWeight += weight;
        } else if (stat.count > 0) {
            // Category was attempted but has 0 score
            totalExperienceWeight += weight;
        }
    });
    const experienceScore = totalExperienceWeight > 0 ? experienceWeightedSum / totalExperienceWeight : 0;

    // Calculate coding score (weighted average including AI assist)
    let codingWeightedSum = 0;
    let totalCodingWeight = 0;
    codingStats.forEach(stat => {
        const weight = 1;
        if (stat.avgStrength > 0) {
            codingWeightedSum += stat.avgStrength * weight;
            totalCodingWeight += weight;
        } else if (stat.count > 0) {
            totalCodingWeight += weight;
        }
    });

    // Add AI assist weight to denominator (it's part of coding score)
    if (aiAssistAccountabilityScore !== null) {
        codingWeightedSum += aiAssistAccountabilityScore * scoringConfig.aiAssistWeight;
    }
    totalCodingWeight += scoringConfig.aiAssistWeight;

    const codingScore = totalCodingWeight > 0 ? codingWeightedSum / totalCodingWeight : 0;

    // Calculate final score (weighted average of experience and coding)
    const totalCategoryWeight = scoringConfig.experienceWeight + scoringConfig.codingWeight;
    const finalScore = (
        (experienceScore * scoringConfig.experienceWeight) +
        (codingScore * scoringConfig.codingWeight)
    ) / totalCategoryWeight;

    return {
        finalScore: Math.round(finalScore),
        experienceScore: Math.round(experienceScore),
        codingScore: Math.round(codingScore),
        aiAssistScore: aiAssistAccountabilityScore !== null ? Math.round(aiAssistAccountabilityScore) : null,
    };
}
