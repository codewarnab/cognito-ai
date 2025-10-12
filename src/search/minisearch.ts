/**
 * MiniSearch Sparse Index Integration
 * 
 * Wraps minisearch for sparse text search with:
 * - Incremental updates with coalescing
 * - Periodic persistence (every N=10 mutations)
 * - Size-bounded storage with eviction
 * - Non-blocking operations via chunked processing
 * - Restore and rebuild flows
 */

import MiniSearch from 'minisearch';
import {
    loadMiniSearchIndex,
    saveMiniSearchIndex,
    deleteMiniSearchIndex,
    iterateAllPages,
    type PageRecord,
    type MiniSearchIndexRecord,
} from '../db/index';
import { MINISEARCH_CONFIG } from '../constants';
import type {
    MiniSearchDoc,
    MiniSearchSearchResult,
    MiniSearchStatsResult,
} from '../types/offscreen';

// ============================================================================
// Types
// ============================================================================

export interface MiniSearchOptions {
    fields?: string[];
    storeFields?: string[];
    searchOptions?: {
        prefix?: boolean;
        fuzzy?: number | boolean;
        boost?: Record<string, number>;
    };
}

interface IndexState {
    index: MiniSearch<MiniSearchDoc> | null;
    mutationsSincePersist: number;
    needsRebuild: boolean;
    isRebuilding: boolean;
    lastPersistedAt: number;
    currentVersion: number;
}

// ============================================================================
// Module State
// ============================================================================

const state: IndexState = {
    index: null,
    mutationsSincePersist: 0,
    needsRebuild: false,
    isRebuilding: false,
    lastPersistedAt: 0,
    currentVersion: MINISEARCH_CONFIG.INDEX_VERSION,
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Truncate text to specified token limit (rough approximation)
 */
function truncateText(text: string, maxTokens: number): string {
    // Simple word-based approximation: ~1.3 tokens per word
    const maxWords = Math.floor(maxTokens / 1.3);
    const words = text.split(/\s+/);

    if (words.length <= maxWords) {
        return text;
    }

    return words.slice(0, maxWords).join(' ') + '...';
}

/**
 * Estimate the serialized size of the index
 */
function estimateIndexSize(index: MiniSearch<MiniSearchDoc>): number {
    try {
        const json = JSON.stringify(index.toJSON());
        return json.length;
    } catch (error) {
        console.error('[MiniSearch] Failed to estimate index size:', error);
        return 0;
    }
}

/**
 * Create a new MiniSearch instance with configured options
 */
function createIndex(options?: Partial<MiniSearchOptions>): MiniSearch<MiniSearchDoc> {
    const fields = options?.fields || [...MINISEARCH_CONFIG.INDEX_FIELDS];
    const storeFields = options?.storeFields || [...MINISEARCH_CONFIG.STORE_FIELDS];

    return new MiniSearch({
        fields,
        storeFields,
        idField: 'id',
        extractField: (document, fieldName) => {
            const value = (document as any)[fieldName];
            return typeof value === 'string' ? value : '';
        },
    });
}

/**
 * Yield control to avoid blocking (simple async yield)
 */
async function yieldControl(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize the MiniSearch index
 * Attempts to restore from IndexedDB or creates a new empty index
 */
export async function initMiniSearch(options?: Partial<MiniSearchOptions>): Promise<void> {
    if (state.index) {
        console.log('[MiniSearch] Already initialized');
        return;
    }

    try {
        // Try to restore from IndexedDB
        const savedRecord = await loadMiniSearchIndex(state.currentVersion);

        if (savedRecord && savedRecord.json) {
            try {
                const indexData = typeof savedRecord.json === 'string'
                    ? JSON.parse(savedRecord.json)
                    : JSON.parse(new TextDecoder().decode(savedRecord.json));

                state.index = MiniSearch.loadJSON(indexData, {
                    fields: options?.fields || [...MINISEARCH_CONFIG.INDEX_FIELDS],
                    storeFields: options?.storeFields || [...MINISEARCH_CONFIG.STORE_FIELDS],
                    idField: 'id',
                });

                state.lastPersistedAt = savedRecord.persistedAt;
                state.mutationsSincePersist = 0;
                state.needsRebuild = false;

                console.log(`[MiniSearch] Restored index with ${savedRecord.docCount} documents`);
                return;
            } catch (error) {
                console.error('[MiniSearch] Failed to restore index, creating new:', error);
                // Fall through to create new index
            }
        }

        // No saved index or version mismatch - create new
        state.index = createIndex(options);
        state.needsRebuild = true;
        state.mutationsSincePersist = 0;
        state.lastPersistedAt = 0;

        console.log('[MiniSearch] Created new empty index');

    } catch (error) {
        console.error('[MiniSearch] Initialization failed:', error);
        throw error;
    }
}

/**
 * Add or update documents in the index
 * Coalesces duplicates by ID
 */
export async function addOrUpdateDocs(docs: MiniSearchDoc[]): Promise<void> {
    if (!state.index) {
        throw new Error('Index not initialized');
    }

    if (docs.length === 0) {
        return;
    }

    // Coalesce duplicates by ID (last one wins)
    const docMap = new Map<string, MiniSearchDoc>();
    for (const doc of docs) {
        docMap.set(doc.id, doc);
    }

    // Truncate text fields to prevent excessive size
    const processedDocs = Array.from(docMap.values()).map(doc => ({
        ...doc,
        text: truncateText(doc.text || '', MINISEARCH_CONFIG.TRUNCATION_TOKENS),
        title: truncateText(doc.title || '', 200), // Title gets shorter limit
    }));

    // Process in micro-batches to avoid blocking
    const batchSize = 50;
    for (let i = 0; i < processedDocs.length; i += batchSize) {
        const batch = processedDocs.slice(i, i + batchSize);

        // Remove existing docs first (if they exist)
        for (const doc of batch) {
            try {
                state.index.discard(doc.id);
            } catch (error) {
                // Doc doesn't exist, that's fine
            }
        }

        // Add new docs
        state.index.addAll(batch);

        // Yield control periodically
        if (i > 0 && i % 100 === 0) {
            await yieldControl();
        }
    }

    state.mutationsSincePersist += processedDocs.length;

    // Auto-persist if threshold reached
    if (state.mutationsSincePersist >= MINISEARCH_CONFIG.PERSIST_EVERY_N) {
        await persist(false);
    }

    console.log(`[MiniSearch] Added/updated ${processedDocs.length} documents`);
}

/**
 * Remove documents from the index by ID
 */
export async function removeDocs(ids: string[]): Promise<void> {
    if (!state.index) {
        throw new Error('Index not initialized');
    }

    if (ids.length === 0) {
        return;
    }

    let removed = 0;
    for (const id of ids) {
        try {
            state.index.discard(id);
            removed++;
        } catch (error) {
            // Doc doesn't exist, ignore
        }
    }

    if (removed > 0) {
        state.mutationsSincePersist += removed;

        // Auto-persist if threshold reached
        if (state.mutationsSincePersist >= MINISEARCH_CONFIG.PERSIST_EVERY_N) {
            await persist(false);
        }
    }

    console.log(`[MiniSearch] Removed ${removed} documents`);
}

/**
 * Search the index
 */
export async function search(
    query: string,
    opts?: { limit?: number; boost?: Record<string, number>; fuzzy?: number | boolean }
): Promise<MiniSearchSearchResult[]> {
    if (!state.index) {
        throw new Error('Index not initialized');
    }

    if (!query || query.trim().length === 0) {
        return [];
    }

    const searchOptions = {
        prefix: MINISEARCH_CONFIG.SEARCH_OPTIONS.prefix,
        fuzzy: opts?.fuzzy ?? MINISEARCH_CONFIG.SEARCH_OPTIONS.fuzzy,
        boost: { ...MINISEARCH_CONFIG.SEARCH_OPTIONS.boost, ...opts?.boost },
    };

    const results = state.index.search(query, searchOptions);

    const limit = opts?.limit || 50;
    return results.slice(0, limit).map(result => ({
        id: result.id,
        url: (result as any).url || '',
        title: (result as any).title || '',
        text: (result as any).text || '',
        score: result.score,
        match: result.match,
    }));
}

/**
 * Persist the index to IndexedDB
 */
export async function persist(force: boolean = false): Promise<void> {
    if (!state.index) {
        throw new Error('Index not initialized');
    }

    // Check if persistence is needed
    if (!force && state.mutationsSincePersist < MINISEARCH_CONFIG.PERSIST_EVERY_N) {
        console.log('[MiniSearch] Skipping persist - not enough mutations');
        return;
    }

    try {
        const indexJSON = state.index.toJSON();
        const jsonString = JSON.stringify(indexJSON);
        const approxBytes = jsonString.length;

        // Check size cap
        if (approxBytes > MINISEARCH_CONFIG.SIZE_CAP_BYTES) {
            console.warn(`[MiniSearch] Index size (${approxBytes} bytes) exceeds cap, evicting documents`);
            await evictDocumentsToFitCap();

            // Re-serialize after eviction
            const newIndexJSON = state.index.toJSON();
            const newJsonString = JSON.stringify(newIndexJSON);
            const newApproxBytes = newJsonString.length;

            const docCount = state.index.documentCount;
            await saveMiniSearchIndex(state.currentVersion, newJsonString, docCount, newApproxBytes);
        } else {
            const docCount = state.index.documentCount;
            await saveMiniSearchIndex(state.currentVersion, jsonString, docCount, approxBytes);
        }

        state.mutationsSincePersist = 0;
        state.lastPersistedAt = Date.now();

        console.log(`[MiniSearch] Persisted index with ${state.index.documentCount} documents (${approxBytes} bytes)`);

    } catch (error) {
        console.error('[MiniSearch] Failed to persist index:', error);
        throw error;
    }
}

/**
 * Evict documents to fit within size cap
 * Strategy: Remove least-recently-updated documents
 */
async function evictDocumentsToFitCap(): Promise<void> {
    if (!state.index) return;

    console.log('[MiniSearch] Starting document eviction to fit size cap');

    // Get all document IDs (we can't easily get lastUpdated from MiniSearch)
    // For now, we'll just remove 20% of documents
    // A more sophisticated approach would track lastUpdated separately

    const allDocs = Array.from((state.index as any).documentIds || []);
    const toRemove = Math.ceil(allDocs.length * 0.2);

    if (toRemove === 0) return;

    // Remove from the beginning (oldest by insertion order as proxy)
    const idsToRemove = allDocs.slice(0, toRemove);

    for (const id of idsToRemove) {
        try {
            state.index.discard(id);
        } catch (error) {
            // Ignore errors
        }
    }

    console.log(`[MiniSearch] Evicted ${idsToRemove.length} documents to reduce size`);
}

/**
 * Get index statistics
 */
export async function getStats(): Promise<MiniSearchStatsResult> {
    if (!state.index) {
        return {
            docCount: 0,
            approxBytes: 0,
            lastPersistedAt: 0,
            needsRebuild: state.needsRebuild,
        };
    }

    const approxBytes = estimateIndexSize(state.index);

    return {
        docCount: state.index.documentCount,
        approxBytes,
        lastPersistedAt: state.lastPersistedAt,
        needsRebuild: state.needsRebuild,
    };
}

/**
 * Clear the index completely
 */
export async function clearIndex(): Promise<void> {
    if (state.index) {
        state.index = createIndex();
    }

    state.mutationsSincePersist = 0;
    state.lastPersistedAt = 0;
    state.needsRebuild = true;

    try {
        await deleteMiniSearchIndex(state.currentVersion);
        console.log('[MiniSearch] Index cleared');
    } catch (error) {
        console.error('[MiniSearch] Failed to clear stored index:', error);
    }
}

/**
 * Rebuild index from all pages in the database
 * Runs in chunks to avoid blocking
 */
export async function rebuildFromPages(): Promise<void> {
    if (state.isRebuilding) {
        console.log('[MiniSearch] Rebuild already in progress');
        return;
    }

    state.isRebuilding = true;

    try {
        console.log('[MiniSearch] Starting index rebuild from pages');

        // Clear existing index
        await clearIndex();

        // Re-initialize
        if (!state.index) {
            state.index = createIndex();
        }

        let totalDocs = 0;
        const batchSize = 100;

        // Iterate over all pages in batches
        for await (const pageBatch of iterateAllPages(batchSize)) {
            const docs: MiniSearchDoc[] = pageBatch.map((page: PageRecord) => ({
                id: page.pageId,
                url: page.url,
                title: page.title || '',
                text: page.description || '',
            }));

            // Add batch to index
            await addOrUpdateDocs(docs);
            totalDocs += docs.length;

            // Log progress
            if (totalDocs % 500 === 0) {
                console.log(`[MiniSearch] Rebuild progress: ${totalDocs} documents indexed`);
            }

            // Yield control periodically
            await yieldControl();
        }

        // Force persist after rebuild
        await persist(true);

        state.needsRebuild = false;
        state.isRebuilding = false;

        console.log(`[MiniSearch] Rebuild complete: ${totalDocs} documents indexed`);

    } catch (error) {
        state.isRebuilding = false;
        console.error('[MiniSearch] Rebuild failed:', error);
        throw error;
    }
}

/**
 * Get the current MiniSearch instance
 * Returns null if the index hasn't been initialized yet
 */
export function getMiniSearchInstance(): MiniSearch<MiniSearchDoc> | null {
    return state.index;
}