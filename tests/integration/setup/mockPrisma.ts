/**
 * Mock Prisma client for deterministic integration testing.
 *
 * This module provides:
 * 1. In-memory database simulation
 * 2. State tracking for verification
 * 3. Helpers to set up test scenarios
 */

import { vi } from 'vitest';

// ============================================================================
// TYPES (matching Prisma schema)
// ============================================================================

export interface MockUser {
    id: string;
    name: string | null;
    email: string;
    role: 'CANDIDATE' | 'COMPANY' | 'ADMIN';
    createdAt: Date;
    updatedAt: Date;
}

export interface MockCompany {
    id: string;
    name: string;
    industry: string;
    size: 'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';
}

export interface MockJob {
    id: string;
    title: string;
    type: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';
    companyId: string;
    company?: MockCompany;
    experienceCategories: unknown | null;
    codingCategories: unknown | null;
    scoringConfiguration?: MockScoringConfiguration | null;
}

export interface MockScoringConfiguration {
    id: string;
    jobId: string;
    aiAssistWeight: number;
    experienceWeight: number;
    codingWeight: number;
}

export interface MockApplication {
    id: string;
    candidateId: string;
    jobId: string;
    status: 'PENDING' | 'REVIEWED' | 'INTERVIEWING' | 'ACCEPTED' | 'REJECTED';
    job?: MockJob;
    candidate?: MockUser;
}

export interface MockInterviewSession {
    id: string;
    candidateId: string;
    applicationId: string;
    application?: MockApplication;
    videoUrl: string | null;
    recordingStartedAt: Date | null;
    startedAt: Date;
    completedAt: Date | null;
    duration: number | null;
    status: string;
    finalScore: number | null;
    telemetryData?: MockTelemetryData | null;
}

export interface MockTelemetryData {
    id: string;
    interviewSessionId: string;
    matchScore: number;
    confidence: string;
    story: string;
    backgroundSummary?: MockBackgroundSummary | null;
    codingSummary?: MockCodingSummary | null;
    workstyleMetrics?: MockWorkstyleMetrics | null;
    evidenceClips?: MockEvidenceClip[];
}

export interface MockBackgroundSummary {
    id: string;
    telemetryDataId: string;
    executiveSummary: string;
    executiveSummaryOneLiner: string | null;
    recommendation: string | null;
    experienceCategories: unknown | null;
    conversationJson: unknown;
    evidenceJson: unknown;
}

export interface MockCodingSummary {
    id: string;
    telemetryDataId: string;
    executiveSummary: string;
    recommendation: string | null;
    codeQualityScore: number;
    codeQualityText: string;
    finalCode: string | null;
    jobSpecificCategories: unknown | null;
}

export interface MockWorkstyleMetrics {
    id: string;
    telemetryDataId: string;
    aiAssistUsage: number | null;
}

export interface MockEvidenceClip {
    id: string;
    telemetryDataId: string;
    title: string;
    description: string;
    duration: number;
    startTime: number | null;
    category: string | null;
    categoryName: string | null;
    contributionStrength: number | null;
}

export interface MockExternalToolUsage {
    id: string;
    interviewSessionId: string;
    timestamp: Date;
    pastedContent: string;
    characterCount: number;
    aiQuestion: string;
    aiQuestionTimestamp: Date;
    userAnswer: string;
    understanding: 'FULL' | 'PARTIAL' | 'NONE';
    accountabilityScore: number;
    reasoning: string;
    caption: string;
}

export interface MockIteration {
    id: string;
    interviewSessionId: string;
    timestamp: Date;
    codeSnapshot: string;
    actualOutput: string;
    expectedOutput: string;
    evaluation: 'CORRECT' | 'PARTIAL' | 'INCORRECT';
    reasoning: string;
    matchPercentage: number;
    caption: string;
}

export interface MockCategoryContribution {
    id: string;
    interviewSessionId: string;
    categoryName: string;
    timestamp: Date;
    codeChange: string;
    explanation: string;
    contributionStrength: number;
    caption: string;
}

export interface MockBackgroundEvidence {
    id: string;
    telemetryDataId: string;
    timestamp: Date;
    questionText: string;
    answerText: string;
    questionNumber: number;
}

// ============================================================================
// IN-MEMORY DATABASE
// ============================================================================

export class MockDatabase {
    users: Map<string, MockUser> = new Map();
    companies: Map<string, MockCompany> = new Map();
    jobs: Map<string, MockJob> = new Map();
    scoringConfigurations: Map<string, MockScoringConfiguration> = new Map();
    applications: Map<string, MockApplication> = new Map();
    interviewSessions: Map<string, MockInterviewSession> = new Map();
    telemetryData: Map<string, MockTelemetryData> = new Map();
    backgroundSummaries: Map<string, MockBackgroundSummary> = new Map();
    codingSummaries: Map<string, MockCodingSummary> = new Map();
    workstyleMetrics: Map<string, MockWorkstyleMetrics> = new Map();
    evidenceClips: Map<string, MockEvidenceClip> = new Map();
    externalToolUsages: Map<string, MockExternalToolUsage> = new Map();
    iterations: Map<string, MockIteration> = new Map();
    categoryContributions: Map<string, MockCategoryContribution> = new Map();
    backgroundEvidence: Map<string, MockBackgroundEvidence> = new Map();

    // Track all operations for verification
    operations: Array<{ type: string; table: string; data: unknown; timestamp: Date }> = [];

    reset(): void {
        this.users.clear();
        this.companies.clear();
        this.jobs.clear();
        this.scoringConfigurations.clear();
        this.applications.clear();
        this.interviewSessions.clear();
        this.telemetryData.clear();
        this.backgroundSummaries.clear();
        this.codingSummaries.clear();
        this.workstyleMetrics.clear();
        this.evidenceClips.clear();
        this.externalToolUsages.clear();
        this.iterations.clear();
        this.categoryContributions.clear();
        this.backgroundEvidence.clear();
        this.operations = [];
    }

    recordOperation(type: string, table: string, data: unknown): void {
        this.operations.push({ type, table, data, timestamp: new Date() });
    }

    getOperations(table?: string, type?: string): Array<{ type: string; table: string; data: unknown; timestamp: Date }> {
        return this.operations.filter(op =>
            (!table || op.table === table) &&
            (!type || op.type === type)
        );
    }
}

// Singleton instance
export const mockDb = new MockDatabase();

// ============================================================================
// ID GENERATION
// ============================================================================

let idCounter = 0;
export function generateId(prefix: string = 'mock'): string {
    return `${prefix}_${++idCounter}_${Date.now()}`;
}

export function resetIdCounter(): void {
    idCounter = 0;
}

// ============================================================================
// MOCK PRISMA CLIENT
// ============================================================================

function createMockPrismaClient() {
    return {
        user: {
            findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
                if (where.id) return mockDb.users.get(where.id) || null;
                if (where.email) {
                    for (const user of mockDb.users.values()) {
                        if (user.email === where.email) return user;
                    }
                }
                return null;
            }),
            create: vi.fn(async ({ data }: { data: Partial<MockUser> }) => {
                const user: MockUser = {
                    id: data.id || generateId('user'),
                    name: data.name || null,
                    email: data.email!,
                    role: data.role || 'CANDIDATE',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                mockDb.users.set(user.id, user);
                mockDb.recordOperation('create', 'user', user);
                return user;
            }),
        },

        company: {
            findUnique: vi.fn(async ({ where }: { where: { id?: string; name?: string } }) => {
                if (where.id) return mockDb.companies.get(where.id) || null;
                if (where.name) {
                    for (const company of mockDb.companies.values()) {
                        if (company.name === where.name) return company;
                    }
                }
                return null;
            }),
            create: vi.fn(async ({ data }: { data: Partial<MockCompany> }) => {
                const company: MockCompany = {
                    id: data.id || generateId('company'),
                    name: data.name!,
                    industry: data.industry || 'Technology',
                    size: data.size || 'MEDIUM',
                };
                mockDb.companies.set(company.id, company);
                mockDb.recordOperation('create', 'company', company);
                return company;
            }),
        },

        job: {
            findUnique: vi.fn(async ({ where, include }: { where: { id: string }; include?: unknown }) => {
                const job = mockDb.jobs.get(where.id);
                if (!job) return null;

                const result: MockJob = { ...job };
                if (include && typeof include === 'object') {
                    const inc = include as Record<string, unknown>;
                    if (inc.company) {
                        result.company = mockDb.companies.get(job.companyId) || undefined;
                    }
                    if (inc.scoringConfiguration) {
                        for (const config of mockDb.scoringConfigurations.values()) {
                            if (config.jobId === job.id) {
                                result.scoringConfiguration = config;
                                break;
                            }
                        }
                    }
                }
                return result;
            }),
            create: vi.fn(async ({ data }: { data: Partial<MockJob> }) => {
                const job: MockJob = {
                    id: data.id || generateId('job'),
                    title: data.title || 'Software Engineer',
                    type: data.type || 'FULL_TIME',
                    companyId: data.companyId!,
                    experienceCategories: data.experienceCategories || null,
                    codingCategories: data.codingCategories || null,
                };
                mockDb.jobs.set(job.id, job);
                mockDb.recordOperation('create', 'job', job);
                return job;
            }),
        },

        scoringConfiguration: {
            findUnique: vi.fn(async ({ where }: { where: { jobId: string } }) => {
                for (const config of mockDb.scoringConfigurations.values()) {
                    if (config.jobId === where.jobId) return config;
                }
                return null;
            }),
            create: vi.fn(async ({ data }: { data: Partial<MockScoringConfiguration> }) => {
                const config: MockScoringConfiguration = {
                    id: data.id || generateId('scoring'),
                    jobId: data.jobId!,
                    aiAssistWeight: data.aiAssistWeight ?? 25,
                    experienceWeight: data.experienceWeight ?? 50,
                    codingWeight: data.codingWeight ?? 50,
                };
                mockDb.scoringConfigurations.set(config.id, config);
                mockDb.recordOperation('create', 'scoringConfiguration', config);
                return config;
            }),
        },

        application: {
            findUnique: vi.fn(async ({ where, include }: { where: { id: string }; include?: unknown }) => {
                const app = mockDb.applications.get(where.id);
                if (!app) return null;

                const result: MockApplication = { ...app };
                if (include && typeof include === 'object') {
                    const inc = include as Record<string, unknown>;
                    if (inc.job) {
                        const job = mockDb.jobs.get(app.jobId);
                        if (job) {
                            result.job = { ...job };
                            if (typeof inc.job === 'object' && (inc.job as Record<string, unknown>).include) {
                                const jobInc = (inc.job as Record<string, unknown>).include as Record<string, unknown>;
                                if (jobInc.company) {
                                    result.job.company = mockDb.companies.get(job.companyId);
                                }
                            }
                        }
                    }
                }
                return result;
            }),
            create: vi.fn(async ({ data }: { data: Partial<MockApplication> }) => {
                const app: MockApplication = {
                    id: data.id || generateId('application'),
                    candidateId: data.candidateId!,
                    jobId: data.jobId!,
                    status: data.status || 'PENDING',
                };
                mockDb.applications.set(app.id, app);
                mockDb.recordOperation('create', 'application', app);
                return app;
            }),
        },

        interviewSession: {
            findUnique: vi.fn(async ({ where, include }: { where: { id: string }; include?: unknown }) => {
                const session = mockDb.interviewSessions.get(where.id);
                if (!session) return null;

                const result: MockInterviewSession = { ...session };
                if (include && typeof include === 'object') {
                    const inc = include as Record<string, unknown>;
                    if (inc.application) {
                        const app = mockDb.applications.get(session.applicationId);
                        if (app) {
                            result.application = { ...app };
                            if (typeof inc.application === 'object') {
                                const appInc = (inc.application as Record<string, unknown>).include as Record<string, unknown>;
                                if (appInc?.job) {
                                    const job = mockDb.jobs.get(app.jobId);
                                    if (job) {
                                        result.application.job = { ...job };
                                        if (typeof appInc.job === 'object') {
                                            const jobInc = (appInc.job as Record<string, unknown>).include as Record<string, unknown>;
                                            if (jobInc?.company) {
                                                result.application.job.company = mockDb.companies.get(job.companyId);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (inc.telemetryData) {
                        for (const td of mockDb.telemetryData.values()) {
                            if (td.interviewSessionId === session.id) {
                                result.telemetryData = { ...td };
                                break;
                            }
                        }
                    }
                }
                return result;
            }),
            findMany: vi.fn(async ({ where }: { where?: { candidateId?: string; applicationId?: string } }) => {
                const results: MockInterviewSession[] = [];
                for (const session of mockDb.interviewSessions.values()) {
                    if (where?.candidateId && session.candidateId !== where.candidateId) continue;
                    if (where?.applicationId && session.applicationId !== where.applicationId) continue;
                    results.push(session);
                }
                return results;
            }),
            create: vi.fn(async ({ data }: { data: Partial<MockInterviewSession> }) => {
                const session: MockInterviewSession = {
                    id: data.id || generateId('session'),
                    candidateId: data.candidateId!,
                    applicationId: data.applicationId!,
                    videoUrl: data.videoUrl || null,
                    recordingStartedAt: data.recordingStartedAt || null,
                    startedAt: data.startedAt || new Date(),
                    completedAt: data.completedAt || null,
                    duration: data.duration || null,
                    status: data.status || 'IN_PROGRESS',
                    finalScore: data.finalScore || null,
                };
                mockDb.interviewSessions.set(session.id, session);
                mockDb.recordOperation('create', 'interviewSession', session);
                return session;
            }),
            update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<MockInterviewSession> }) => {
                const session = mockDb.interviewSessions.get(where.id);
                if (!session) throw new Error(`InterviewSession not found: ${where.id}`);

                const updated = { ...session, ...data };
                mockDb.interviewSessions.set(where.id, updated);
                mockDb.recordOperation('update', 'interviewSession', { where, data: updated });
                return updated;
            }),
        },

        telemetryData: {
            findUnique: vi.fn(async ({ where }: { where: { interviewSessionId: string } }) => {
                for (const td of mockDb.telemetryData.values()) {
                    if (td.interviewSessionId === where.interviewSessionId) return td;
                }
                return null;
            }),
            create: vi.fn(async ({ data }: { data: Partial<MockTelemetryData> }) => {
                const td: MockTelemetryData = {
                    id: data.id || generateId('telemetry'),
                    interviewSessionId: data.interviewSessionId!,
                    matchScore: data.matchScore || 0,
                    confidence: data.confidence || 'MEDIUM',
                    story: data.story || '',
                };
                mockDb.telemetryData.set(td.id, td);
                mockDb.recordOperation('create', 'telemetryData', td);
                return td;
            }),
            update: vi.fn(async ({ where, data }: { where: { interviewSessionId: string }; data: Partial<MockTelemetryData> }) => {
                let td: MockTelemetryData | undefined;
                for (const t of mockDb.telemetryData.values()) {
                    if (t.interviewSessionId === where.interviewSessionId) {
                        td = t;
                        break;
                    }
                }
                if (!td) throw new Error(`TelemetryData not found for session: ${where.interviewSessionId}`);

                const updated = { ...td, ...data };
                mockDb.telemetryData.set(td.id, updated);
                mockDb.recordOperation('update', 'telemetryData', { where, data: updated });
                return updated;
            }),
        },

        backgroundSummary: {
            findUnique: vi.fn(async ({ where }: { where: { telemetryDataId: string } }) => {
                for (const bs of mockDb.backgroundSummaries.values()) {
                    if (bs.telemetryDataId === where.telemetryDataId) return bs;
                }
                return null;
            }),
            create: vi.fn(async ({ data }: { data: Partial<MockBackgroundSummary> }) => {
                const bs: MockBackgroundSummary = {
                    id: data.id || generateId('bgSummary'),
                    telemetryDataId: data.telemetryDataId!,
                    executiveSummary: data.executiveSummary || '',
                    executiveSummaryOneLiner: data.executiveSummaryOneLiner || null,
                    recommendation: data.recommendation || null,
                    experienceCategories: data.experienceCategories || null,
                    conversationJson: data.conversationJson || {},
                    evidenceJson: data.evidenceJson || {},
                };
                mockDb.backgroundSummaries.set(bs.id, bs);
                mockDb.recordOperation('create', 'backgroundSummary', bs);
                return bs;
            }),
            update: vi.fn(async ({ where, data }: { where: { telemetryDataId: string }; data: Partial<MockBackgroundSummary> }) => {
                let bs: MockBackgroundSummary | undefined;
                for (const b of mockDb.backgroundSummaries.values()) {
                    if (b.telemetryDataId === where.telemetryDataId) {
                        bs = b;
                        break;
                    }
                }
                if (!bs) throw new Error(`BackgroundSummary not found for telemetry: ${where.telemetryDataId}`);

                const updated = { ...bs, ...data };
                mockDb.backgroundSummaries.set(bs.id, updated);
                mockDb.recordOperation('update', 'backgroundSummary', { where, data: updated });
                return updated;
            }),
        },

        codingSummary: {
            findUnique: vi.fn(async ({ where }: { where: { telemetryDataId: string } }) => {
                for (const cs of mockDb.codingSummaries.values()) {
                    if (cs.telemetryDataId === where.telemetryDataId) return cs;
                }
                return null;
            }),
            create: vi.fn(async ({ data }: { data: Partial<MockCodingSummary> }) => {
                const cs: MockCodingSummary = {
                    id: data.id || generateId('codeSummary'),
                    telemetryDataId: data.telemetryDataId!,
                    executiveSummary: data.executiveSummary || '',
                    recommendation: data.recommendation || null,
                    codeQualityScore: data.codeQualityScore || 0,
                    codeQualityText: data.codeQualityText || '',
                    finalCode: data.finalCode || null,
                    jobSpecificCategories: data.jobSpecificCategories || null,
                };
                mockDb.codingSummaries.set(cs.id, cs);
                mockDb.recordOperation('create', 'codingSummary', cs);
                return cs;
            }),
            update: vi.fn(async ({ where, data }: { where: { telemetryDataId: string }; data: Partial<MockCodingSummary> }) => {
                let cs: MockCodingSummary | undefined;
                for (const c of mockDb.codingSummaries.values()) {
                    if (c.telemetryDataId === where.telemetryDataId) {
                        cs = c;
                        break;
                    }
                }
                if (!cs) throw new Error(`CodingSummary not found for telemetry: ${where.telemetryDataId}`);

                const updated = { ...cs, ...data };
                mockDb.codingSummaries.set(cs.id, updated);
                mockDb.recordOperation('update', 'codingSummary', { where, data: updated });
                return updated;
            }),
        },

        externalToolUsage: {
            findMany: vi.fn(async ({ where }: { where?: { interviewSessionId?: string } }) => {
                const results: MockExternalToolUsage[] = [];
                for (const etu of mockDb.externalToolUsages.values()) {
                    if (where?.interviewSessionId && etu.interviewSessionId !== where.interviewSessionId) continue;
                    results.push(etu);
                }
                return results;
            }),
            create: vi.fn(async ({ data }: { data: Partial<MockExternalToolUsage> }) => {
                const etu: MockExternalToolUsage = {
                    id: data.id || generateId('externalTool'),
                    interviewSessionId: data.interviewSessionId!,
                    timestamp: data.timestamp || new Date(),
                    pastedContent: data.pastedContent || '',
                    characterCount: data.characterCount || 0,
                    aiQuestion: data.aiQuestion || '',
                    aiQuestionTimestamp: data.aiQuestionTimestamp || new Date(),
                    userAnswer: data.userAnswer || '',
                    understanding: data.understanding || 'PARTIAL',
                    accountabilityScore: data.accountabilityScore || 50,
                    reasoning: data.reasoning || '',
                    caption: data.caption || '',
                };
                mockDb.externalToolUsages.set(etu.id, etu);
                mockDb.recordOperation('create', 'externalToolUsage', etu);
                return etu;
            }),
        },

        iteration: {
            findMany: vi.fn(async ({ where }: { where?: { interviewSessionId?: string } }) => {
                const results: MockIteration[] = [];
                for (const iter of mockDb.iterations.values()) {
                    if (where?.interviewSessionId && iter.interviewSessionId !== where.interviewSessionId) continue;
                    results.push(iter);
                }
                return results;
            }),
            create: vi.fn(async ({ data }: { data: Partial<MockIteration> }) => {
                const iter: MockIteration = {
                    id: data.id || generateId('iteration'),
                    interviewSessionId: data.interviewSessionId!,
                    timestamp: data.timestamp || new Date(),
                    codeSnapshot: data.codeSnapshot || '',
                    actualOutput: data.actualOutput || '',
                    expectedOutput: data.expectedOutput || '',
                    evaluation: data.evaluation || 'INCORRECT',
                    reasoning: data.reasoning || '',
                    matchPercentage: data.matchPercentage || 0,
                    caption: data.caption || '',
                };
                mockDb.iterations.set(iter.id, iter);
                mockDb.recordOperation('create', 'iteration', iter);
                return iter;
            }),
        },

        categoryContribution: {
            findMany: vi.fn(async ({ where }: { where?: { interviewSessionId?: string; categoryName?: string } }) => {
                const results: MockCategoryContribution[] = [];
                for (const cc of mockDb.categoryContributions.values()) {
                    if (where?.interviewSessionId && cc.interviewSessionId !== where.interviewSessionId) continue;
                    if (where?.categoryName && cc.categoryName !== where.categoryName) continue;
                    results.push(cc);
                }
                return results;
            }),
            create: vi.fn(async ({ data }: { data: Partial<MockCategoryContribution> }) => {
                const cc: MockCategoryContribution = {
                    id: data.id || generateId('contribution'),
                    interviewSessionId: data.interviewSessionId!,
                    categoryName: data.categoryName || '',
                    timestamp: data.timestamp || new Date(),
                    codeChange: data.codeChange || '',
                    explanation: data.explanation || '',
                    contributionStrength: data.contributionStrength || 0,
                    caption: data.caption || '',
                };
                mockDb.categoryContributions.set(cc.id, cc);
                mockDb.recordOperation('create', 'categoryContribution', cc);
                return cc;
            }),
        },

        evidenceClip: {
            findMany: vi.fn(async ({ where }: { where?: { telemetryDataId?: string } }) => {
                const results: MockEvidenceClip[] = [];
                for (const ec of mockDb.evidenceClips.values()) {
                    if (where?.telemetryDataId && ec.telemetryDataId !== where.telemetryDataId) continue;
                    results.push(ec);
                }
                return results;
            }),
            create: vi.fn(async ({ data }: { data: Partial<MockEvidenceClip> }) => {
                const ec: MockEvidenceClip = {
                    id: data.id || generateId('evidence'),
                    telemetryDataId: data.telemetryDataId!,
                    title: data.title || '',
                    description: data.description || '',
                    duration: data.duration || 0,
                    startTime: data.startTime || null,
                    category: data.category || null,
                    categoryName: data.categoryName || null,
                    contributionStrength: data.contributionStrength || null,
                };
                mockDb.evidenceClips.set(ec.id, ec);
                mockDb.recordOperation('create', 'evidenceClip', ec);
                return ec;
            }),
        },

        backgroundEvidence: {
            findMany: vi.fn(async ({ where }: { where?: { telemetryDataId?: string } }) => {
                const results: MockBackgroundEvidence[] = [];
                for (const be of mockDb.backgroundEvidence.values()) {
                    if (where?.telemetryDataId && be.telemetryDataId !== where.telemetryDataId) continue;
                    results.push(be);
                }
                return results;
            }),
            create: vi.fn(async ({ data }: { data: Partial<MockBackgroundEvidence> }) => {
                const be: MockBackgroundEvidence = {
                    id: data.id || generateId('bgEvidence'),
                    telemetryDataId: data.telemetryDataId!,
                    timestamp: data.timestamp || new Date(),
                    questionText: data.questionText || '',
                    answerText: data.answerText || '',
                    questionNumber: data.questionNumber || 1,
                };
                mockDb.backgroundEvidence.set(be.id, be);
                mockDb.recordOperation('create', 'backgroundEvidence', be);
                return be;
            }),
        },
    };
}

// Export mock prisma client
export const mockPrismaClient = createMockPrismaClient();

// ============================================================================
// VITEST MOCK SETUP
// ============================================================================

export function setupPrismaMock(): void {
    vi.mock('lib/prisma', () => ({
        default: mockPrismaClient,
    }));
}

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Reset all mocks and database state
 */
export function resetMocks(): void {
    mockDb.reset();
    resetIdCounter();
    // Reset all mock function calls
    Object.values(mockPrismaClient).forEach(model => {
        Object.values(model).forEach(fn => {
            if (typeof fn === 'function' && 'mockClear' in fn) {
                (fn as ReturnType<typeof vi.fn>).mockClear();
            }
        });
    });
}
