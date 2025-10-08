/**
 * Dexie IndexedDB Layer for History Search Extension
 * 
 * Provides typed database interface with:
 * - Pages, chunks (with Float32Array embeddings), images, miniSearchIndex
 * - Settings and queue management
 * - Schema versioning and migrations (v1-v4)
 * - Quota management and eviction policies
 */

import Dexie, { type Table } from 'dexie';
import { DB_CAPS, SETTINGS_KEYS, QUEUE_STATUS } from '../constants';

// ============================================================================
// Type Definitions
// ============================================================================

export interface PageRecord {
    pageId: string;
    url: string;
    domain: string;
    title?: string;
    description?: string;
    firstSeen: number;
    lastUpdated: number;
    lastAccessed: number;
}

export interface ChunkRecord {
    chunkId: string;
    url: string;
    pageId: string;
    chunkIndex: number;
    tokenLength: number;
    text: string;
    embedding: ArrayBuffer; // Float32Array stored as ArrayBuffer
    createdAt: number;
    lastAccessed: number;
}

export interface ImageRecord {
    imageId: string;
    url: string; // Image source URL
    pageUrl: string;
    pageId: string;
    captionText?: string;
}

export interface QueueItem {
    id: string;
    type: string;
    status: 'pending' | 'running' | 'done' | 'failed';
    priority: number;
    payload: any;
    createdAt: number;
    updatedAt: number;
    attempts: number;
    lastError?: string;
}

export interface MiniSearchIndexRecord {
    version: number;
    json: string | Uint8Array;
    docCount: number;
    persistedAt: number;
    approxBytes: number;
}

export interface SettingRecord {
    key: string;
    value: any;
}

/**
 * Privacy and application settings
 */
export interface Settings {
    modelVersion: string | null;
    paused: boolean;
    domainAllowlist: string[];
    domainDenylist: string[];
    lastMiniSearchPersistAt?: number;
}

// ============================================================================
// Dexie Database Class
// ============================================================================

export class AppDB extends Dexie {
    pages!: Table<PageRecord, string>;
    chunks!: Table<ChunkRecord, string>;
    images!: Table<ImageRecord, string>;
    miniSearchIndex!: Table<MiniSearchIndexRecord, number>;
    settings!: Table<SettingRecord, string>;
    queue!: Table<QueueItem, string>;

    constructor() {
        super('HistorySearchDB');

        // Version 1: Initial schema
        this.version(1).stores({
            pages: 'pageId, url, domain, firstSeen, lastUpdated',
            chunks: 'chunkId, url, pageId, chunkIndex, tokenLength, createdAt',
            images: 'imageId, pageUrl, pageId',
            settings: 'key'
        });

        // Version 2: Add miniSearchIndex store and additional indexes
        this.version(2).stores({
            pages: 'pageId, url, domain, firstSeen, lastUpdated',
            chunks: 'chunkId, url, pageId, chunkIndex, tokenLength, createdAt',
            images: 'imageId, pageUrl, pageId',
            settings: 'key',
            miniSearchIndex: 'version'
        });

        // Version 3: Add queue store
        this.version(3).stores({
            pages: 'pageId, url, domain, firstSeen, lastUpdated',
            chunks: 'chunkId, url, pageId, chunkIndex, tokenLength, createdAt',
            images: 'imageId, pageUrl, pageId',
            settings: 'key',
            miniSearchIndex: 'version',
            queue: 'id, type, status, priority, createdAt, updatedAt'
        }).upgrade(async (tx) => {
            // Backfill defaults for queue items if any exist
            await tx.table('queue').toCollection().modify((item: any) => {
                if (!item.status) item.status = 'pending';
                if (item.priority === undefined) item.priority = 0;
                if (!item.createdAt) item.createdAt = Date.now();
                if (!item.updatedAt) item.updatedAt = Date.now();
                if (item.attempts === undefined) item.attempts = 0;
            });
        });

        // Version 4: Add lastAccessed for eviction
        this.version(4).stores({
            pages: 'pageId, url, domain, firstSeen, lastUpdated, lastAccessed',
            chunks: 'chunkId, url, pageId, chunkIndex, tokenLength, createdAt, lastAccessed',
            images: 'imageId, pageUrl, pageId',
            settings: 'key',
            miniSearchIndex: 'version',
            queue: 'id, type, status, priority, createdAt, updatedAt'
        }).upgrade(async (tx) => {
            // Backfill lastAccessed for pages
            await tx.table('pages').toCollection().modify((page: any) => {
                page.lastAccessed = page.lastUpdated ?? page.firstSeen ?? Date.now();
            });

            // Backfill lastAccessed for chunks
            await tx.table('chunks').toCollection().modify((chunk: any) => {
                chunk.lastAccessed = chunk.createdAt ?? Date.now();
            });
        });
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let dbInstance: AppDB | null = null;

/**
 * Open and return the singleton database instance
 */
export async function openDb(): Promise<AppDB> {
    if (!dbInstance) {
        dbInstance = new AppDB();

        // Request persistent storage (best-effort)
        if (navigator.storage?.persist) {
            try {
                const isPersistent = await navigator.storage.persist();
                console.log('Storage persistence:', isPersistent);
            } catch (err) {
                console.warn('Could not request storage persistence:', err);
            }
        }

        await dbInstance.open();
    }
    return dbInstance;
}

/**
 * Reset the database (delete and recreate)
 * Use with caution - this deletes all data
 */
export async function resetDatabase(): Promise<void> {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }

    await Dexie.delete('HistorySearchDB');
    dbInstance = new AppDB();
    await dbInstance.open();
}

// ============================================================================
// Page APIs
// ============================================================================

/**
 * Insert or update a page record
 */
export async function upsertPage(page: PageRecord): Promise<void> {
    const db = await openDb();
    await db.pages.put(page);
}

/**
 * Get a page by its ID
 */
export async function getPageById(pageId: string): Promise<PageRecord | undefined> {
    const db = await openDb();
    return await db.pages.get(pageId);
}

/**
 * Get the most recent page for a given URL
 */
export async function getLatestPageByUrl(url: string): Promise<PageRecord | undefined> {
    const db = await openDb();
    const pages = await db.pages
        .where('url')
        .equals(url)
        .reverse()
        .sortBy('lastUpdated');

    return pages[0];
}

/**
 * List pages by domain with optional limit
 */
export async function listPagesByDomain(domain: string, limit?: number): Promise<PageRecord[]> {
    const db = await openDb();
    let query = db.pages.where('domain').equals(domain);

    if (limit) {
        return await query.limit(limit).toArray();
    }

    return await query.toArray();
}

/**
 * Update lastAccessed timestamp for a page
 */
export async function touchPage(pageId: string): Promise<void> {
    const db = await openDb();
    await db.pages.update(pageId, { lastAccessed: Date.now() });
}

/**
 * Delete multiple pages by ID
 * Returns the number of pages deleted
 */
export async function deletePages(pageIds: string[]): Promise<number> {
    const db = await openDb();

    await db.transaction('rw', [db.pages, db.chunks, db.images], async () => {
        // Delete associated chunks and images
        for (const pageId of pageIds) {
            await db.chunks.where('pageId').equals(pageId).delete();
            await db.images.where('pageId').equals(pageId).delete();
        }

        // Delete pages
        await db.pages.bulkDelete(pageIds);
    });

    return pageIds.length;
}

// ============================================================================
// Chunk APIs
// ============================================================================

/**
 * Bulk insert or update chunk records
 * Handles large batches by splitting into smaller operations
 */
export async function bulkPutChunks(chunks: ChunkRecord[]): Promise<void> {
    const db = await openDb();

    try {
        // Process in batches to avoid blocking
        for (let i = 0; i < chunks.length; i += DB_CAPS.BULK_BATCH_SIZE) {
            const batch = chunks.slice(i, i + DB_CAPS.BULK_BATCH_SIZE);
            await db.chunks.bulkPut(batch);
        }
    } catch (error: any) {
        // Handle quota exceeded error
        if (error.name === 'QuotaExceededError') {
            await handleQuotaExceeded();
            // Retry once after eviction
            for (let i = 0; i < chunks.length; i += DB_CAPS.BULK_BATCH_SIZE) {
                const batch = chunks.slice(i, i + DB_CAPS.BULK_BATCH_SIZE);
                await db.chunks.bulkPut(batch);
            }
        } else {
            throw error;
        }
    }
}

/**
 * Get all chunks for a page
 */
export async function listChunksByPage(pageId: string): Promise<ChunkRecord[]> {
    const db = await openDb();
    return await db.chunks.where('pageId').equals(pageId).sortBy('chunkIndex');
}

/**
 * Stream all chunk embeddings (for vector search)
 * Yields {chunkId, embedding as Float32Array}
 */
export async function* streamAllChunkEmbeddings(): AsyncGenerator<{
    chunkId: string;
    embedding: Float32Array;
}> {
    const db = await openDb();

    const cursor = await db.chunks.toCollection().primaryKeys();

    for (const chunkId of cursor) {
        const chunk = await db.chunks.get(chunkId);
        if (chunk && chunk.embedding) {
            yield {
                chunkId: chunk.chunkId,
                embedding: new Float32Array(chunk.embedding)
            };
        }
    }
}

/**
 * Evict old chunks for a page, keeping only the newest N
 * Returns the number of chunks evicted
 */
export async function evictChunksForPage(pageId: string, keepNewest: number): Promise<number> {
    const db = await openDb();

    const chunks = await db.chunks
        .where('pageId')
        .equals(pageId)
        .reverse()
        .sortBy('chunkIndex');

    if (chunks.length <= keepNewest) {
        return 0;
    }

    const toDelete = chunks.slice(keepNewest);
    const chunkIds = toDelete.map(c => c.chunkId);

    await db.chunks.bulkDelete(chunkIds);

    return chunkIds.length;
}

/**
 * Update lastAccessed timestamp for multiple chunks
 */
export async function touchChunks(chunkIds: string[]): Promise<void> {
    const db = await openDb();
    const now = Date.now();

    await db.chunks.bulkUpdate(
        chunkIds.map(id => ({ key: id, changes: { lastAccessed: now } }))
    );
}

// ============================================================================
// Image APIs
// ============================================================================

/**
 * Bulk insert or update image records
 */
export async function bulkPutImages(images: ImageRecord[]): Promise<void> {
    const db = await openDb();

    for (let i = 0; i < images.length; i += DB_CAPS.BULK_BATCH_SIZE) {
        const batch = images.slice(i, i + DB_CAPS.BULK_BATCH_SIZE);
        await db.images.bulkPut(batch);
    }
}

/**
 * Get all images for a page
 */
export async function listImagesByPage(pageId: string): Promise<ImageRecord[]> {
    const db = await openDb();
    return await db.images.where('pageId').equals(pageId).toArray();
}

// ============================================================================
// MiniSearch Index APIs
// ============================================================================

/**
 * Save the miniSearch index to IndexedDB
 */
export async function saveMiniSearchIndex(
    version: number,
    json: string | Uint8Array,
    docCount: number,
    approxBytes: number
): Promise<void> {
    const db = await openDb();
    await db.miniSearchIndex.put({
        version,
        json,
        docCount,
        persistedAt: Date.now(),
        approxBytes
    });
    await setSetting(SETTINGS_KEYS.MINISEARCH_VERSION, version);
}

/**
 * Load the miniSearch index from IndexedDB
 */
export async function loadMiniSearchIndex(
    version: number
): Promise<MiniSearchIndexRecord | undefined> {
    const db = await openDb();
    const record = await db.miniSearchIndex.get(version);
    return record;
}

/**
 * Delete the miniSearch index for a specific version
 */
export async function deleteMiniSearchIndex(version: number): Promise<void> {
    const db = await openDb();
    await db.miniSearchIndex.delete(version);
}

/**
 * Get all pages as an async iterator for rebuilding the search index
 * Yields pages in batches to avoid loading everything in memory
 */
export async function* iterateAllPages(batchSize: number = 100): AsyncGenerator<PageRecord[]> {
    const db = await openDb();

    let offset = 0;
    while (true) {
        const batch = await db.pages
            .orderBy('lastUpdated')
            .offset(offset)
            .limit(batchSize)
            .toArray();

        if (batch.length === 0) break;

        yield batch;
        offset += batchSize;
    }
}

// ============================================================================
// Settings APIs
// ============================================================================

/**
 * Get a setting value by key
 */
export async function getSetting<T>(key: string): Promise<T | undefined> {
    const db = await openDb();
    const record = await db.settings.get(key);
    return record?.value as T | undefined;
}

/**
 * Set a setting value
 */
export async function setSetting<T>(key: string, value: T): Promise<void> {
    const db = await openDb();
    await db.settings.put({ key, value });
}

/**
 * Get the current settings (privacy + app config)
 * Returns defaults if not yet initialized
 */
export async function getSettings(): Promise<Settings> {
    const db = await openDb();
    const record = await db.settings.get('current');

    if (!record) {
        // Return and persist defaults
        const defaults: Settings = {
            modelVersion: null,
            paused: false,
            domainAllowlist: [],
            domainDenylist: [],
        };
        await db.settings.put({ key: 'current', value: defaults });
        return defaults;
    }

    return record.value as Settings;
}

/**
 * Update settings (partial update)
 * Also syncs paused/allowlist/denylist to chrome.storage.local for fast content script access
 */
export async function updateSettings(partial: Partial<Settings>): Promise<Settings> {
    const db = await openDb();
    const current = await getSettings();
    const updated: Settings = { ...current, ...partial };

    await db.settings.put({ key: 'current', value: updated });

    // Mirror privacy settings to chrome.storage.local for fast content script access
    await chrome.storage.local.set({
        paused: updated.paused,
        domainAllowlist: updated.domainAllowlist,
        domainDenylist: updated.domainDenylist,
    });

    return updated;
}

/**
 * Normalize a hostname (lowercase, punycode if needed)
 */
export function normalizeHostname(hostname: string): string {
    try {
        const url = new URL(`https://${hostname}`);
        return url.hostname.toLowerCase();
    } catch {
        return hostname.toLowerCase();
    }
}

/**
 * Check if a URL's hostname is blocked by privacy settings
 */
export function isHostBlocked(url: string, settings: { paused?: boolean; domainAllowlist?: string[]; domainDenylist?: string[] }): boolean {
    if (settings.paused) return true;

    try {
        const hostname = new URL(url).hostname.toLowerCase();
        const allowlist = settings.domainAllowlist || [];
        const denylist = settings.domainDenylist || [];

        // If allowlist exists and hostname not in it, block
        if (allowlist.length > 0 && !allowlist.includes(hostname)) {
            return true;
        }

        // If hostname is in denylist, block
        if (denylist.includes(hostname)) {
            return true;
        }

        return false;
    } catch {
        // Invalid URL, block by default
        return true;
    }
}

// ============================================================================
// Queue APIs
// ============================================================================

/**
 * Add a job to the queue
 * Returns the job ID
 */
export async function enqueue(job: Omit<QueueItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const db = await openDb();

    const id = crypto.randomUUID();
    const now = Date.now();

    const queueItem: QueueItem = {
        id,
        type: job.type,
        status: job.status || 'pending',
        priority: job.priority || 0,
        payload: job.payload,
        attempts: job.attempts || 0,
        createdAt: now,
        updatedAt: now,
        lastError: job.lastError
    };

    await db.queue.add(queueItem);
    return id;
}

/**
 * Get the next pending job from the queue
 * Prioritizes by priority (descending) then FIFO
 */
export async function dequeue(types?: string[]): Promise<QueueItem | undefined> {
    const db = await openDb();

    let query = db.queue.where('status').equals('pending');

    // Filter by types if provided
    if (types && types.length > 0) {
        const allPending = await query.toArray();
        const filtered = allPending.filter(item => types.includes(item.type));

        // Sort by priority (desc) then createdAt (asc)
        filtered.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            return a.createdAt - b.createdAt;
        });

        return filtered[0];
    }

    // Get all pending and sort
    const pending = await query.toArray();
    pending.sort((a, b) => {
        if (a.priority !== b.priority) {
            return b.priority - a.priority;
        }
        return a.createdAt - b.createdAt;
    });

    return pending[0];
}

/**
 * Mark a job as done
 */
export async function markDone(id: string): Promise<void> {
    const db = await openDb();
    await db.queue.update(id, {
        status: 'done',
        updatedAt: Date.now()
    });
}

/**
 * Mark a job as failed with optional error message
 */
export async function markFailed(id: string, error?: string): Promise<void> {
    const db = await openDb();

    const job = await db.queue.get(id);
    if (job) {
        await db.queue.update(id, {
            status: 'failed',
            updatedAt: Date.now(),
            attempts: job.attempts + 1,
            lastError: error
        });
    }
}

// ============================================================================
// Quota and Eviction Management
// ============================================================================

/**
 * Handle quota exceeded error by evicting old data
 */
async function handleQuotaExceeded(): Promise<void> {
    const db = await openDb();

    console.warn('Quota exceeded, triggering eviction...');

    // Get counts
    const pageCount = await db.pages.count();
    const chunkCount = await db.chunks.count();

    // Calculate how many to remove
    const pagesToRemove = Math.ceil(
        Math.max(0, pageCount - DB_CAPS.MAX_PAGES) +
        pageCount * DB_CAPS.EVICTION_PERCENTAGE
    );

    const chunksToRemove = Math.ceil(
        Math.max(0, chunkCount - DB_CAPS.MAX_CHUNKS) +
        chunkCount * DB_CAPS.EVICTION_PERCENTAGE
    );

    if (pagesToRemove > 0) {
        // Get oldest pages by lastAccessed
        const oldestPages = await db.pages
            .orderBy('lastAccessed')
            .limit(pagesToRemove)
            .toArray();

        const pageIds = oldestPages.map(p => p.pageId);

        if (pageIds.length > 0) {
            await deletePages(pageIds);
            console.log(`Evicted ${pageIds.length} old pages`);
        }
    }

    if (chunksToRemove > 0) {
        // Get oldest chunks by lastAccessed
        const oldestChunks = await db.chunks
            .orderBy('lastAccessed')
            .limit(chunksToRemove)
            .toArray();

        const chunkIds = oldestChunks.map(c => c.chunkId);

        if (chunkIds.length > 0) {
            await db.chunks.bulkDelete(chunkIds);
            console.log(`Evicted ${chunkIds.length} old chunks`);
        }
    }

    // Update last eviction timestamp
    await setSetting(SETTINGS_KEYS.LAST_EVICTION_TIMESTAMP, Date.now());
}

/**
 * Manually trigger eviction check
 */
export async function checkAndEvictIfNeeded(): Promise<void> {
    const db = await openDb();

    const pageCount = await db.pages.count();
    const chunkCount = await db.chunks.count();

    if (pageCount > DB_CAPS.MAX_PAGES || chunkCount > DB_CAPS.MAX_CHUNKS) {
        await handleQuotaExceeded();
    }
}

/**
 * Evict chunks for all pages, keeping only newest N per page
 */
export async function evictChunksGlobally(keepPerPage: number = DB_CAPS.MAX_CHUNKS_PER_PAGE): Promise<number> {
    const db = await openDb();

    const pages = await db.pages.toArray();
    let totalEvicted = 0;

    for (const page of pages) {
        const evicted = await evictChunksForPage(page.pageId, keepPerPage);
        totalEvicted += evicted;
    }

    console.log(`Globally evicted ${totalEvicted} chunks, keeping ${keepPerPage} per page`);
    return totalEvicted;
}

// ============================================================================
// Helper Utilities
// ============================================================================

/**
 * Convert Float32Array to ArrayBuffer for storage
 */
export function embeddingToBuffer(embedding: Float32Array): ArrayBuffer {
    return embedding.buffer.slice(0) as ArrayBuffer;
}

/**
 * Convert ArrayBuffer back to Float32Array
 */
export function bufferToEmbedding(buffer: ArrayBuffer): Float32Array {
    return new Float32Array(buffer);
}

/**
 * Get database statistics
 */
export async function getDbStats(): Promise<{
    pageCount: number;
    chunkCount: number;
    imageCount: number;
    queueCount: number;
}> {
    const db = await openDb();

    const [pageCount, chunkCount, imageCount, queueCount] = await Promise.all([
        db.pages.count(),
        db.chunks.count(),
        db.images.count(),
        db.queue.count()
    ]);

    return { pageCount, chunkCount, imageCount, queueCount };
}

// ============================================================================
// Privacy: Data Wipe
// ============================================================================

/**
 * Wipe all user data from IndexedDB and optionally clear model cache
 * @param alsoRemoveModel - If true, also removes cached model files from Cache Storage
 */
export async function wipeAllData(alsoRemoveModel: boolean = false): Promise<void> {
    const db = await openDb();

    console.log('Starting data wipe...');

    // Clear all data stores
    await db.transaction('rw', [db.pages, db.chunks, db.images, db.miniSearchIndex, db.queue], async () => {
        await db.pages.clear();
        await db.chunks.clear();
        await db.images.clear();
        await db.miniSearchIndex.clear();
        await db.queue.clear();
    });

    // Reset settings to defaults
    const defaults: Settings = {
        modelVersion: alsoRemoveModel ? null : (await getSettings()).modelVersion,
        paused: false,
        domainAllowlist: [],
        domainDenylist: [],
    };

    await db.settings.clear();
    await db.settings.put({ key: 'current', value: defaults });

    // Clear chrome.storage.local mirrors
    await chrome.storage.local.remove(['paused', 'domainAllowlist', 'domainDenylist']);

    // Optionally clear model cache from Cache Storage
    if (alsoRemoveModel && 'caches' in self) {
        try {
            const cacheNames = await caches.keys();
            for (const name of cacheNames) {
                if (name.startsWith('model/')) {
                    await caches.delete(name);
                    console.log(`Deleted cache: ${name}`);
                }
            }
        } catch (err) {
            console.warn('Failed to clear model cache:', err);
        }
    }

    console.log('Data wipe completed');
}
