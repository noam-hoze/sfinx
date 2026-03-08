/**
 * Test script for profile story generation
 * Run with: pnpm tsx scripts/test-profile-story.ts
 */

import prisma from '../lib/prisma';

async function testProfileStory() {
    try {
        console.log('🔍 Finding Noam\'s latest interview session...\n');
        
        // Find Noam's user
        const noam = await prisma.user.findFirst({
            where: {
                name: { contains: 'Noam', mode: 'insensitive' }
            }
        });

        if (!noam) {
            console.error('❌ Noam not found in database');
            return;
        }

        console.log(`✅ Found user: ${noam.name} (${noam.id})`);

        // Get latest interview session with telemetry
        const session = await prisma.interviewSession.findFirst({
            where: {
                candidateId: noam.id,
                telemetryData: {
                    isNot: null
                }
            },
            include: {
                telemetryData: {
                    include: {
                        backgroundSummary: true,
                        codingSummary: true,
                    }
                },
                application: {
                    include: {
                        job: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        if (!session) {
            console.error('❌ No interview session with telemetry found for Noam');
            return;
        }

        console.log(`✅ Found session: ${session.id}`);
        console.log(`   Job: ${session.application.job.title}`);
        console.log(`   Created: ${session.createdAt}`);
        console.log(`   Has background summary: ${!!session.telemetryData?.backgroundSummary}`);
        console.log(`   Has coding summary: ${!!session.telemetryData?.codingSummary}`);
        console.log(`   Current story: ${session.telemetryData?.story ? '"' + session.telemetryData.story + '"' : 'null'}\n`);

        if (!session.telemetryData?.backgroundSummary || !session.telemetryData?.codingSummary) {
            console.error('❌ Session missing required summaries');
            return;
        }

        console.log('🚀 Calling /api/interviews/generate-profile-story...\n');

        // Call the API endpoint
        const response = await fetch('http://localhost:3000/api/interviews/generate-profile-story', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sessionId: session.id
            })
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('❌ API Error:', result);
            return;
        }

        console.log('✅ Profile story generated!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📝 GENERATED STORY:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(result.story);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`\n📊 Character count: ${result.story.length} / 250`);

        // Fetch updated telemetry to verify it was saved
        const updatedSession = await prisma.interviewSession.findUnique({
            where: { id: session.id },
            include: {
                telemetryData: true
            }
        });

        if (updatedSession?.telemetryData?.story === result.story) {
            console.log('✅ Story saved to database successfully\n');
        } else {
            console.log('⚠️  Story may not have been saved to database\n');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testProfileStory();
