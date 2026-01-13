/**
 * Test script that calls the API directly (no Prisma queries)
 * Run with: pnpm tsx scripts/test-profile-story-api.ts
 */

async function testProfileStory() {
    try {
        const sessionId = 'cmkbwd1og0001sb96dndgdscz';
        
        console.log('🚀 Calling /api/interviews/generate-profile-story...\n');
        console.log(`   Session ID: ${sessionId}\n`);

        const response = await fetch('http://localhost:3000/api/interviews/generate-profile-story', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionId })
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('❌ API Error:', result);
            return;
        }

        console.log('✅ Profile story generated!\n');
        
        if (result.debug) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔍 PASS 1: EXTRACTION PROMPT');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(result.debug.extractionPrompt);
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📦 EXTRACTED DATA:');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(JSON.stringify(result.debug.extractedData, null, 2));
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✍️  PASS 2: FORMATTING PROMPT');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(result.debug.formattingPrompt);
            console.log('\n');
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📝 GENERATED STORY:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(result.story);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`\n📊 Character count: ${result.story.length} / 300`);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testProfileStory();
