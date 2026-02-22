import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from 'lib/prisma';

/**
 * Integration test for profile story generation.
 * Requires:
 *   - DATABASE_URL pointing at a reachable Postgres instance
 *   - A Next.js dev/prod server running on http://localhost:3000
 *
 * Skipped automatically in unit-test runs (CI, local `vitest run`).
 * To run manually: DATABASE_URL=<url> RUN_INTEGRATION_TESTS=1 npx vitest run route.test.ts
 */
const isIntegrationEnv =
    !!process.env.DATABASE_URL && !!process.env.RUN_INTEGRATION_TESTS;

describe.skipIf(!isIntegrationEnv)('Profile Story Generation', () => {
    let testSessionId: string;
    let testJobId: string;
    let testCandidateId: string;
    let testApplicationId: string;
    let testTelemetryId: string;

    beforeAll(async () => {
        // Create test data (candidates are stored as User records with role CANDIDATE)
        const testCandidate = await prisma.user.create({
            data: {
                id: 'test-candidate-story',
                name: 'Test Candidate',
                email: 'test@example.com',
            },
        });
        testCandidateId = testCandidate.id;

        const testJob = await prisma.job.create({
            data: {
                id: 'test-job-story',
                title: 'Deep Learning Engineer',
                type: 'FULL_TIME',
                description: 'Test job',
                location: 'Remote',
                companyId: 'test-company',
                scoringConfiguration: {
                    create: {
                        aiAssistWeight: 25,
                        experienceWeight: 50,
                        codingWeight: 50,
                    },
                },
            },
        });
        testJobId = testJob.id;

        const testApplication = await prisma.application.create({
            data: {
                id: 'test-application-story',
                candidateId: testCandidateId,
                jobId: testJobId,
                status: 'INTERVIEWING',
            },
        });
        testApplicationId = testApplication.id;

        const testSession = await prisma.interviewSession.create({
            data: {
                id: 'test-session-story',
                candidateId: testCandidateId,
                applicationId: testApplicationId,
                status: 'COMPLETED',
                finalScore: 10,
            },
        });
        testSessionId = testSession.id;

        // Create telemetry with summaries
        const telemetry = await prisma.telemetryData.create({
            data: {
                interviewSessionId: testSessionId,
                matchScore: 10,
                confidence: 'LOW',
                story: '',
                backgroundSummary: {
                    create: {
                        executiveSummary: 'Limited experience in deep learning and signal processing.',
                        experienceCategories: {
                            deep_learning: { name: 'Deep Learning', score: 25, weight: 1 },
                            signal_processing: { name: 'Signal Processing', score: 30, weight: 1 },
                        },
                        conversationJson: {},
                        evidenceJson: {},
                    },
                },
                codingSummary: {
                    create: {
                        executiveSummary: 'Struggled with coding tasks.',
                        codeQualityScore: 15,
                        codeQualityText: 'Needs Improvement',
                        jobSpecificCategories: {
                            python: { name: 'Python', score: 20, weight: 1 },
                            algorithms: { name: 'Algorithms', score: 10, weight: 1 },
                        },
                    },
                },
            },
        });
        testTelemetryId = telemetry.id;

        // Create external tool usage with low accountability
        await prisma.externalToolUsage.create({
            data: {
                interviewSessionId: testSessionId,
                pastedContent: 'test code',
                characterCount: 100,
                aiQuestion: 'What does this do?',
                aiQuestionTimestamp: new Date(),
                userAnswer: 'Not sure',
                understanding: 'NONE',
                accountabilityScore: 15,
                reasoning: 'Poor understanding',
                caption: 'Copied code without understanding',
            },
        });
    });

    afterAll(async () => {
        // Clean up test data
        await prisma.externalToolUsage.deleteMany({ where: { interviewSessionId: testSessionId } });
        await prisma.backgroundSummary.deleteMany({ where: { telemetryDataId: testTelemetryId } });
        await prisma.codingSummary.deleteMany({ where: { telemetryDataId: testTelemetryId } });
        await prisma.telemetryData.delete({ where: { id: testTelemetryId } });
        await prisma.interviewSession.delete({ where: { id: testSessionId } });
        await prisma.application.delete({ where: { id: testApplicationId } });
        await prisma.scoringConfiguration.deleteMany({ where: { jobId: testJobId } });
        await prisma.job.delete({ where: { id: testJobId } });
        await prisma.user.delete({ where: { id: testCandidateId } });
    });

    it('should generate profile story with performance context and emphasis', async () => {
        const response = await fetch('http://localhost:3000/api/interviews/generate-profile-story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: testSessionId }),
        });

        expect(response.ok).toBe(true);

        const data = await response.json();

        // Check story exists and is not empty
        expect(data.story).toBeTruthy();
        expect(data.story.length).toBeGreaterThan(0);
        expect(data.story.length).toBeLessThanOrEqual(280);

        // Check emphasis ranges exist
        expect(data.emphasisRanges).toBeDefined();
        expect(Array.isArray(data.emphasisRanges)).toBe(true);
        expect(data.emphasisRanges.length).toBeGreaterThan(0);

        // Check emphasis has weaknesses (low-performance candidate)
        const hasWeakness = data.emphasisRanges.some((r: any) => r.type === 'weakness');
        expect(hasWeakness).toBe(true); // Low performance should have weaknesses

        // Verify story reflects low performance
        const storyLower = data.story.toLowerCase();
        const hasLowPerformanceIndicators =
            storyLower.includes('limited') ||
            storyLower.includes('struggled') ||
            storyLower.includes('needs') ||
            storyLower.includes('developing');
        expect(hasLowPerformanceIndicators).toBe(true);

        // Verify accountability is mentioned (low accountability score)
        const hasAccountabilityMention =
            storyLower.includes('relied') ||
            storyLower.includes('understanding') ||
            storyLower.includes('resources');
        expect(hasAccountabilityMention).toBe(true);

        // Check database was updated
        const updatedTelemetry = await prisma.telemetryData.findUnique({
            where: { id: testTelemetryId },
        });
        expect(updatedTelemetry?.story).toBe(data.story);
        expect(updatedTelemetry?.storyEmphasis).toBeDefined();

        console.log('\n✅ Generated Story:', data.story);
        console.log('✅ Emphasis Ranges:', JSON.stringify(data.emphasisRanges, null, 2));
    });

    it('should fail loudly when summaries are missing (constitution compliance)', async () => {
        // Create session without summaries
        const emptySession = await prisma.interviewSession.create({
            data: {
                id: 'test-session-empty',
                candidateId: testCandidateId,
                applicationId: testApplicationId,
                status: 'COMPLETED',
            },
        });

        await prisma.telemetryData.create({
            data: {
                interviewSessionId: emptySession.id,
                matchScore: 0,
                confidence: 'UNKNOWN',
                story: '',
            },
        });

        const response = await fetch('http://localhost:3000/api/interviews/generate-profile-story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: emptySession.id }),
        });

        // Should return 400 with clear error
        expect(response.status).toBe(400);

        const errorData = await response.json();
        expect(errorData.error).toBeDefined();
        expect(errorData.details).toBeDefined();
        expect(errorData.details.hasBackgroundSummary).toBe(false);
        expect(errorData.details.hasCodingSummary).toBe(false);

        // Clean up
        await prisma.telemetryData.deleteMany({ where: { interviewSessionId: emptySession.id } });
        await prisma.interviewSession.delete({ where: { id: emptySession.id } });

        console.log('\n✅ Failed loudly as expected:', errorData);
    });
});
