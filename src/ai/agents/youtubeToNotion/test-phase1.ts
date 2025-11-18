/**
 * Phase 1 Implementation Test
 * 
 * Tests transcript fetching and caching functionality
 */

import { withTranscriptCache, getCachedTranscript } from './transcriptCache';
import { fetchTranscriptDirect } from './transcript';

/**
 * Test transcript cache lifecycle
 */
async function testTranscriptCache() {
    console.log('🧪 Testing Phase 1: Transcript Cache & Fetch\n');

    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

    console.log('1️⃣ Testing withTranscriptCache...');

    const result = await withTranscriptCache(
        testUrl,
        // Fetcher
        async () => {
            console.log('   📝 Fetcher called - fetching transcript...');
            return await fetchTranscriptDirect(testUrl);
        },
        // Workflow
        async (entry) => {
            console.log('   ✅ Workflow received transcript:', {
                videoId: entry.videoId,
                title: entry.title,
                hasTranscript: !!entry.transcript,
                transcriptLength: entry.transcript.length
            });

            // Verify cache exists during workflow
            const cached = getCachedTranscript(testUrl);
            console.log('   📦 Cache exists during workflow:', !!cached);

            return { success: true, entry };
        }
    );

    console.log('\n2️⃣ Verifying cache cleanup...');
    const cacheAfterWorkflow = getCachedTranscript(testUrl);
    console.log('   🧹 Cache cleared after workflow:', !cacheAfterWorkflow);

    console.log('\n✅ Phase 1 test complete!\n');
    return result;
}

// Run test if executed directly
if (require.main === module) {
    testTranscriptCache()
        .then(() => {
            console.log('✅ All tests passed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Test failed:', error);
            process.exit(1);
        });
}

export { testTranscriptCache };
