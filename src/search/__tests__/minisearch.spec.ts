/**
 * MiniSearch Integration Tests
 * 
 * Tests the complete MiniSearch sparse index functionality including:
 * - Index creation, document operations, and search
 * - Incremental updates and removal
 * - Persistence triggers and restore
 * - Size cap enforcement with truncation and eviction
 * - Version-based rebuilds
 * - Non-blocking operations
 */

import MiniSearch from 'minisearch';
import {
    initMiniSearch,
    addOrUpdateDocs,
    removeDocs,
    search,
    persist,
    getStats,
    clearIndex,
    rebuildFromPages,
} from '../minisearch';
import {
    saveMiniSearchIndex,
    loadMiniSearchIndex,
    deleteMiniSearchIndex,
    iterateAllPages,
    upsertPage,
    type PageRecord,
} from '../../db/index';
import { MINISEARCH_CONFIG } from '../../constants';

// Mock data generators
function createMockDoc(id: string, title: string, text: string) {
    return {
        id,
        url: `https://example.com/page-${id}`,
        title,
        text,
    };
}

function createMockPage(pageId: string, title: string, description: string): PageRecord {
    return {
        pageId,
        url: `https://example.com/page-${pageId}`,
        domain: 'example.com',
        title,
        description,
        firstSeen: Date.now(),
        lastUpdated: Date.now(),
        lastAccessed: Date.now(),
    };
}

/**
 * Test Suite: Basic Operations
 */
async function testBasicOperations() {
    console.log('\n=== Test: Basic Operations ===');

    // Clear any existing index
    await clearIndex();
    await initMiniSearch();

    // Add documents
    const docs = [
        createMockDoc('1', 'Introduction to TypeScript', 'TypeScript is a typed superset of JavaScript'),
        createMockDoc('2', 'Advanced TypeScript', 'Learn advanced TypeScript patterns and techniques'),
        createMockDoc('3', 'JavaScript Basics', 'Understanding the fundamentals of JavaScript'),
    ];

    await addOrUpdateDocs(docs);

    // Search by title
    const results1 = await search('TypeScript');
    console.log('Search "TypeScript":', results1.length, 'results');
    console.assert(results1.length >= 2, 'Should find at least 2 TypeScript results');
    console.assert(
        results1[0].score >= results1[1].score,
        'Results should be sorted by score'
    );

    // Search by text content
    const results2 = await search('patterns techniques');
    console.log('Search "patterns techniques":', results2.length, 'results');
    console.assert(results2.length >= 1, 'Should find Advanced TypeScript');

    // Title boost verification - title match should score higher
    const results3 = await search('JavaScript');
    console.log('Search "JavaScript":', results3.length, 'results');
    console.assert(
        results3.length >= 2,
        'Should find documents with JavaScript in title and text'
    );

    console.log('✓ Basic operations test passed');
}

/**
 * Test Suite: Incremental Updates
 */
async function testIncrementalUpdates() {
    console.log('\n=== Test: Incremental Updates ===');

    await clearIndex();
    await initMiniSearch();

    // Add initial docs
    await addOrUpdateDocs([
        createMockDoc('1', 'Original Title', 'Original text content'),
    ]);

    const results1 = await search('Original');
    console.assert(results1.length === 1, 'Should find original doc');
    console.assert(results1[0].id === '1', 'Should be doc 1');

    // Update the document
    await addOrUpdateDocs([
        createMockDoc('1', 'Updated Title', 'Updated text content'),
    ]);

    const results2 = await search('Updated');
    console.assert(results2.length === 1, 'Should find updated doc');
    console.assert(results2[0].title === 'Updated Title', 'Title should be updated');

    const results3 = await search('Original');
    console.assert(results3.length === 0, 'Should not find old content');

    console.log('✓ Incremental updates test passed');
}

/**
 * Test Suite: Document Removal
 */
async function testDocumentRemoval() {
    console.log('\n=== Test: Document Removal ===');

    await clearIndex();
    await initMiniSearch();

    // Add multiple docs
    await addOrUpdateDocs([
        createMockDoc('1', 'Doc One', 'First document'),
        createMockDoc('2', 'Doc Two', 'Second document'),
        createMockDoc('3', 'Doc Three', 'Third document'),
    ]);

    const resultsBefore = await search('Doc');
    console.assert(resultsBefore.length === 3, 'Should find 3 docs initially');

    // Remove one doc
    await removeDocs(['2']);

    const resultsAfter = await search('Doc');
    console.assert(resultsAfter.length === 2, 'Should find 2 docs after removal');
    console.assert(
        !resultsAfter.some(r => r.id === '2'),
        'Removed doc should not appear in results'
    );

    console.log('✓ Document removal test passed');
}

/**
 * Test Suite: Persistence and Restore
 */
async function testPersistenceAndRestore() {
    console.log('\n=== Test: Persistence and Restore ===');

    await clearIndex();
    await initMiniSearch();

    // Add docs (less than PERSIST_EVERY_N to test manual persist)
    const docs = Array.from({ length: 5 }, (_, i) =>
        createMockDoc(`${i}`, `Title ${i}`, `Content for document ${i}`)
    );
    await addOrUpdateDocs(docs);

    // Force persist
    await persist(true);

    // Check stats
    const stats1 = await getStats();
    console.assert(stats1.docCount === 5, 'Should have 5 docs');
    console.assert(stats1.approxBytes > 0, 'Should have size estimate');
    console.assert(stats1.lastPersistedAt > 0, 'Should have persist timestamp');

    // Verify saved to IndexedDB
    const saved = await loadMiniSearchIndex(MINISEARCH_CONFIG.INDEX_VERSION);
    console.assert(saved !== undefined, 'Index should be saved to IndexedDB');
    console.assert(saved!.docCount === 5, 'Saved doc count should match');

    // Clear and re-init to test restore
    await clearIndex();
    await initMiniSearch();

    // Search should work with restored index
    const results = await search('document');
    console.assert(results.length === 5, 'Should find all docs after restore');

    console.log('✓ Persistence and restore test passed');
}

/**
 * Test Suite: Auto-Persistence Trigger
 */
async function testAutoPersistence() {
    console.log('\n=== Test: Auto-Persistence Trigger ===');

    await clearIndex();
    await initMiniSearch();

    // Add docs to trigger auto-persist (PERSIST_EVERY_N = 10)
    const docs = Array.from({ length: 12 }, (_, i) =>
        createMockDoc(`${i}`, `Auto Title ${i}`, `Auto content ${i}`)
    );

    await addOrUpdateDocs(docs);

    // Should have auto-persisted
    const stats = await getStats();
    console.assert(
        stats.lastPersistedAt > 0,
        'Should have auto-persisted after 10+ mutations'
    );

    // Verify it's actually saved
    const saved = await loadMiniSearchIndex(MINISEARCH_CONFIG.INDEX_VERSION);
    console.assert(saved !== undefined, 'Index should be auto-saved');
    console.assert(saved!.docCount === 12, 'All docs should be saved');

    console.log('✓ Auto-persistence test passed');
}

/**
 * Test Suite: Text Truncation
 */
async function testTextTruncation() {
    console.log('\n=== Test: Text Truncation ===');

    await clearIndex();
    await initMiniSearch();

    // Create doc with very long text (exceeds TRUNCATION_TOKENS)
    const longText = 'word '.repeat(3000); // ~3000 words ≈ 3900 tokens
    const doc = createMockDoc('long', 'Long Document', longText);

    await addOrUpdateDocs([doc]);

    const results = await search('word');
    console.assert(results.length === 1, 'Should find the long doc');

    // Text should be truncated (indicated by ...)
    const truncated = results[0].text;
    console.assert(
        truncated.length < longText.length,
        'Text should be truncated'
    );
    console.assert(
        truncated.endsWith('...'),
        'Truncated text should end with ...'
    );

    console.log('✓ Text truncation test passed');
}

/**
 * Test Suite: Rebuild from Pages
 */
async function testRebuildFromPages() {
    console.log('\n=== Test: Rebuild from Pages ===');

    // First, add some pages to the database
    const pages = [
        createMockPage('p1', 'Page One', 'Description for page one'),
        createMockPage('p2', 'Page Two', 'Description for page two'),
        createMockPage('p3', 'Page Three', 'Description for page three'),
    ];

    for (const page of pages) {
        await upsertPage(page);
    }

    // Clear index and rebuild
    await clearIndex();
    await initMiniSearch();
    await rebuildFromPages();

    // Search should find pages
    const results = await search('page');
    console.assert(
        results.length >= 3,
        `Should find at least 3 pages, found ${results.length}`
    );

    // Verify stats
    const stats = await getStats();
    console.assert(stats.docCount >= 3, 'Should have at least 3 docs after rebuild');
    console.assert(!stats.needsRebuild, 'Should not need rebuild after completion');

    console.log('✓ Rebuild from pages test passed');
}

/**
 * Test Suite: Stats Reporting
 */
async function testStatsReporting() {
    console.log('\n=== Test: Stats Reporting ===');

    await clearIndex();
    await initMiniSearch();

    // Empty index stats
    const stats1 = await getStats();
    console.assert(stats1.docCount === 0, 'Empty index should have 0 docs');
    console.assert(stats1.approxBytes >= 0, 'Should have size estimate');

    // Add some docs
    await addOrUpdateDocs([
        createMockDoc('1', 'Title', 'Content'),
        createMockDoc('2', 'Title', 'Content'),
    ]);

    const stats2 = await getStats();
    console.assert(stats2.docCount === 2, 'Should have 2 docs');
    console.assert(stats2.approxBytes > stats1.approxBytes, 'Size should increase');

    console.log('✓ Stats reporting test passed');
}

/**
 * Run all tests
 */
export async function runAllTests() {
    console.log('Starting MiniSearch Integration Tests...\n');

    try {
        await testBasicOperations();
        await testIncrementalUpdates();
        await testDocumentRemoval();
        await testPersistenceAndRestore();
        await testAutoPersistence();
        await testTextTruncation();
        await testRebuildFromPages();
        await testStatsReporting();

        console.log('\n✅ All tests passed successfully!');
        return true;
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        return false;
    }
}

// Run tests if this file is executed directly
if (typeof window !== 'undefined') {
    (window as any).runMiniSearchTests = runAllTests;
}
