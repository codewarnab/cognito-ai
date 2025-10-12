/**
 * Queue operations for background processing
 */

import { openDb, QUEUE_STORE } from './database';
import { updateQueueStats } from './settings';
import type { BgQueueRecord } from './types';

// Configuration
const COALESCE_BUCKET_MS = 60_000; // 1 minute
const BACKOFF_BASE_MS = 10_000;
const BACKOFF_MAX_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_ATTEMPTS = 8;
const BACKOFF_JITTER_MIN = 0.5;
const BACKOFF_JITTER_MAX = 1.5;

/**
 * Generate coalesce key for time bucketing
 */
function getCoalesceKey(url: string, timestamp: number): string {
    const bucket = Math.floor(timestamp / COALESCE_BUCKET_MS);
    return `${url}#${bucket}`;
}

/**
 * Calculate exponential backoff with jitter
 */
function calculateBackoff(attempt: number): number {
    const exponential = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt), BACKOFF_MAX_MS);
    const jitter = BACKOFF_JITTER_MIN + Math.random() * (BACKOFF_JITTER_MAX - BACKOFF_JITTER_MIN);
    return Math.floor(exponential * jitter);
}

/**
 * Enqueue a page visit for processing
 */
export async function enqueuePageSeen(
    url: string,
    title?: string,
    description?: string,
    payload?: BgQueueRecord['payload'],
    source: BgQueueRecord['source'] = 'content'
): Promise<string> {
    const database = await openDb();
    const now = Date.now();
    const id = getCoalesceKey(url, now);

    return new Promise((resolve, reject) => {
        const tx = database.transaction([QUEUE_STORE], 'readwrite');
        const store = tx.objectStore(QUEUE_STORE);

        // Try to read existing record
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
            const existing = getRequest.result as BgQueueRecord | undefined;

            const record: BgQueueRecord = existing
                ? {
                    ...existing,
                    title: title ?? existing.title,
                    description: description ?? existing.description,
                    payload: payload ?? existing.payload,
                    lastUpdatedAt: now,
                }
                : {
                    id,
                    url,
                    title,
                    description,
                    source,
                    firstEnqueuedAt: now,
                    lastUpdatedAt: now,
                    attempt: 0,
                    nextAttemptAt: now,
                    payload,
                };

            const putRequest = store.put(record);
            putRequest.onsuccess = () => resolve(id);
            putRequest.onerror = () => reject(putRequest.error);
        };

        getRequest.onerror = () => reject(getRequest.error);
    });
}

/**
 * Dequeue a batch of jobs ready for processing
 */
export async function dequeueBatch(now: number, batchSize: number): Promise<BgQueueRecord[]> {
    const database = await openDb();

    return new Promise((resolve, reject) => {
        const tx = database.transaction([QUEUE_STORE], 'readonly');
        const store = tx.objectStore(QUEUE_STORE);
        const index = store.index('by_nextAttemptAt');

        const range = IDBKeyRange.upperBound(now);
        const request = index.openCursor(range);

        const results: BgQueueRecord[] = [];

        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor && results.length < batchSize) {
                results.push(cursor.value as BgQueueRecord);
                cursor.continue();
            } else {
                // Sort by firstEnqueuedAt for FIFO within the nextAttemptAt constraint
                results.sort((a, b) => a.firstEnqueuedAt - b.firstEnqueuedAt);
                resolve(results);
            }
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Mark a job as successfully completed
 */
export async function markSuccess(id: string): Promise<void> {
    const database = await openDb();

    return new Promise((resolve, reject) => {
        const tx = database.transaction([QUEUE_STORE], 'readwrite');

        // Delete from queue
        const queueStore = tx.objectStore(QUEUE_STORE);
        const deleteRequest = queueStore.delete(id);

        deleteRequest.onsuccess = async () => {
            // Update stats
            await updateQueueStats('successes', 1);
            resolve();
        };

        deleteRequest.onerror = () => reject(deleteRequest.error);
    });
}

/**
 * Mark a job as failed and schedule retry if applicable
 */
export async function markFailure(id: string, error: string, isRetriable: boolean): Promise<void> {
    const database = await openDb();

    return new Promise((resolve, reject) => {
        const tx = database.transaction([QUEUE_STORE], 'readwrite');
        const store = tx.objectStore(QUEUE_STORE);

        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
            const record = getRequest.result as BgQueueRecord | undefined;
            if (!record) {
                resolve();
                return;
            }

            const newAttempt = record.attempt + 1;

            // Check if non-retriable or exceeded max attempts
            if (!isRetriable || newAttempt >= MAX_ATTEMPTS) {
                // Move to dead letter (mark as dead)
                record.attempt = newAttempt;
                record.source = 'retry';
                record.nextAttemptAt = Number.MAX_SAFE_INTEGER; // Never retry
                record.lastUpdatedAt = Date.now();
            } else {
                // Calculate backoff with jitter
                const backoff = calculateBackoff(newAttempt);
                record.attempt = newAttempt;
                record.nextAttemptAt = Date.now() + backoff;
                record.lastUpdatedAt = Date.now();
            }

            const putRequest = store.put(record);
            putRequest.onsuccess = async () => {
                if (!isRetriable || newAttempt >= MAX_ATTEMPTS) {
                    await updateQueueStats('failures', 1);
                }
                resolve();
            };
            putRequest.onerror = () => reject(putRequest.error);
        };

        getRequest.onerror = () => reject(getRequest.error);
    });
}

/**
 * Clear all items from the queue
 */
export async function clearQueue(): Promise<void> {
    const database = await openDb();
    const tx = database.transaction([QUEUE_STORE], 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);

    return new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
