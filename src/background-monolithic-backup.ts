/**
 * MV3 Background Service Worker
 * 
 * Orchestrates:
 * - Persistent FIFO queue with coalescing (IndexedDB)
 * - Alarm-based scheduling with budgets
 * - Offscreen document lifecycle
 * - Model readiness gating
 * - Exponential backoff and retry logic
 * - Message routing between content/offscreen/worker
 */

import {
    ensureModelReady,
    isModelReady,
    initializeModelSystem,
    handleModelRetryAlarm,
    getModelDebugInfo,
} from './background/model-ready';

import { isHostBlocked, updateSettings, wipeAllData } from './db/index';

// ============================================================================
// Constants & Configuration
// ============================================================================

const ALARM_NAME = 'bg:schedule';
const ALARM_PERIOD_MINUTES = 1;

const DB_NAME = 'chromeAi';
const DB_VERSION = 1;
const QUEUE_STORE = 'bgQueue';
const SETTINGS_STORE = 'settings';

// Processing budgets
const PROCESS_BATCH_SIZE = 8;
const PROCESS_BATCH_SIZE_IDLE = 24;
const PROCESS_TIME_BUDGET_MS = 250;
const MAX_OFFSCREEN_LIFETIME_MS = 15_000;

// Time bucketing for coalescing (1 minute)
const COALESCE_BUCKET_MS = 60_000;

// Backoff parameters
const BACKOFF_BASE_MS = 10_000;
const BACKOFF_MAX_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_ATTEMPTS = 8;
const BACKOFF_JITTER_MIN = 0.5;
const BACKOFF_JITTER_MAX = 1.5;

// Model version key
const MODEL_VERSION_KEY = 'modelVersion';
const PAUSED_KEY = 'paused';
const QUEUE_STATS_KEY = 'queueStats';

// Offscreen document
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// ============================================================================
// Type Definitions
// ============================================================================

// Background Queue Record
export interface BgQueueRecord {
    id: string; // `${url}#${bucketTs}`
    url: string;
    title?: string;
    description?: string;
    source: 'content' | 'manual' | 'retry';
    firstEnqueuedAt: number;
    lastUpdatedAt: number;
    attempt: number;
    nextAttemptAt: number;
    payload?: {
        textPreview?: string;
        images?: Array<{
            src: string;
            alt?: string;
            caption?: string;
            nearbyText?: string;
        }>;
    };
}

// Settings
export interface Settings {
    modelVersion?: string;
    paused?: boolean;
    queueStats?: {
        total: number;
        successes: number;
        failures: number;
    };
}

// Message schemas
export type BgMsgFromContent =
    | { type: 'PageSeen'; url: string; title?: string; description?: string; payload?: BgQueueRecord['payload'] }
    | { type: 'TogglePause'; paused: boolean }
    | { type: 'ClearIndex' }
    | { type: 'CheckModelReady' }
    | { type: 'GetModelDebugInfo' }
    | { type: 'settings:update'; payload: Partial<Settings> }
    | { type: 'privacy:wipe'; alsoRemoveModel?: boolean; delayMs?: number }
    | { type: 'privacy:wipe:cancel' };

export type BgMsgToContent =
    | { type: 'Ack'; id?: string }
    | { type: 'Error'; message: string };

export type BgMsgToOffscreen =
    | { type: 'ProcessBatch'; jobs: Array<{ url: string; title?: string; description?: string; payload?: any }> }
    | { type: 'InitWorker' };

export type OffscreenMsgToBg =
    | { type: 'BatchResult'; ok: true; results: Array<{ id: string; url: string }> }
    | { type: 'BatchResult'; ok: false; errors: Array<{ id: string; url: string; message: string }> }
    | { type: 'WorkerReady' };

export type WorkerMsg =
    | { type: 'EmbedChunks'; jobs: Array<{ id: string; url: string; text: string; images?: Array<{ caption: string }> }> }
    | { type: 'EmbedResult'; id: string; ok: boolean; error?: string };

// ============================================================================
// IndexedDB Setup
// ============================================================================

let db: IDBDatabase | null = null;

async function openDb(): Promise<IDBDatabase> {
    if (db) return db;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;

            // Create bgQueue store
            if (!database.objectStoreNames.contains(QUEUE_STORE)) {
                const queueStore = database.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
                queueStore.createIndex('by_nextAttemptAt', 'nextAttemptAt', { unique: false });
                queueStore.createIndex('by_url', 'url', { unique: false });
            }

            // Create settings store
            if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
                database.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
            }
        };
    });
}

// ============================================================================
// Queue Operations
// ============================================================================

function getCoalesceKey(url: string, timestamp: number): string {
    const bucket = Math.floor(timestamp / COALESCE_BUCKET_MS);
    return `${url}#${bucket}`;
}

async function enqueuePageSeen(
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

async function dequeueBatch(now: number, batchSize: number): Promise<BgQueueRecord[]> {
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

async function markSuccess(id: string): Promise<void> {
    const database = await openDb();

    return new Promise((resolve, reject) => {
        const tx = database.transaction([QUEUE_STORE, SETTINGS_STORE], 'readwrite');

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

async function markFailure(id: string, error: string, isRetriable: boolean): Promise<void> {
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

function calculateBackoff(attempt: number): number {
    const exponential = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt), BACKOFF_MAX_MS);
    const jitter = BACKOFF_JITTER_MIN + Math.random() * (BACKOFF_JITTER_MAX - BACKOFF_JITTER_MIN);
    return Math.floor(exponential * jitter);
}

async function updateQueueStats(field: 'successes' | 'failures', increment: number): Promise<void> {
    const database = await openDb();

    return new Promise((resolve, reject) => {
        const tx = database.transaction([SETTINGS_STORE], 'readwrite');
        const store = tx.objectStore(SETTINGS_STORE);

        const getRequest = store.get(QUEUE_STATS_KEY);

        getRequest.onsuccess = () => {
            const existing = getRequest.result as { key: string; value: Settings['queueStats'] } | undefined;
            const stats = existing?.value ?? { total: 0, successes: 0, failures: 0 };

            stats[field] = (stats[field] ?? 0) + increment;
            stats.total = stats.successes + stats.failures;

            const putRequest = store.put({ key: QUEUE_STATS_KEY, value: stats });
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
        };

        getRequest.onerror = () => reject(getRequest.error);
    });
}

// ============================================================================
// Settings Operations
// ============================================================================

async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K] | undefined> {
    const database = await openDb();

    return new Promise((resolve, reject) => {
        const tx = database.transaction([SETTINGS_STORE], 'readonly');
        const store = tx.objectStore(SETTINGS_STORE);
        const request = store.get(key);

        request.onsuccess = () => {
            const result = request.result as { key: string; value: Settings[K] } | undefined;
            resolve(result?.value);
        };

        request.onerror = () => reject(request.error);
    });
}

async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    const database = await openDb();

    return new Promise((resolve, reject) => {
        const tx = database.transaction([SETTINGS_STORE], 'readwrite');
        const store = tx.objectStore(SETTINGS_STORE);
        const request = store.put({ key, value });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ============================================================================
// Pause State
// ============================================================================

async function isPaused(): Promise<boolean> {
    const paused = await getSetting('paused');
    return paused ?? false;
}

async function setPaused(paused: boolean): Promise<void> {
    await setSetting('paused', paused);
    console.log('[Background] Pause state:', paused);
}

// ============================================================================
// Offscreen Document Lifecycle
// ============================================================================

let offscreenCreatedAt: number | null = null;

async function ensureOffscreen(): Promise<void> {
    // Check if offscreen is already created and still valid
    const now = Date.now();
    if (offscreenCreatedAt && (now - offscreenCreatedAt) < MAX_OFFSCREEN_LIFETIME_MS) {
        return;
    }

    try {
        // Check if offscreen document exists
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
        });

        if (existingContexts.length > 0) {
            offscreenCreatedAt = now;
            return;
        }

        // Create offscreen document
        await chrome.offscreen.createDocument({
            url: OFFSCREEN_DOCUMENT_PATH,
            reasons: ['WORKERS' as chrome.offscreen.Reason],
            justification: 'Run embedding model and search workers',
        });

        offscreenCreatedAt = now;
        console.log('[Background] Offscreen document created');
    } catch (error) {
        console.error('[Background] Failed to create offscreen:', error);
        offscreenCreatedAt = null;
        throw error;
    }
}

async function closeOffscreenIfIdle(): Promise<void> {
    const now = Date.now();
    if (!offscreenCreatedAt || (now - offscreenCreatedAt) < MAX_OFFSCREEN_LIFETIME_MS) {
        return;
    }

    try {
        await chrome.offscreen.closeDocument();
        offscreenCreatedAt = null;
        console.log('[Background] Offscreen document closed (idle)');
    } catch (error) {
        // Ignore errors (document might already be closed)
    }
}

// ============================================================================
// Alarm Scheduler
// ============================================================================

async function ensureAlarms(): Promise<void> {
    const existing = await chrome.alarms.get(ALARM_NAME);

    if (!existing) {
        await chrome.alarms.create(ALARM_NAME, {
            periodInMinutes: ALARM_PERIOD_MINUTES,
        });
        console.log('[Background] Alarm created:', ALARM_NAME);
    }
}

function getBatchSize(): number {
    // Check if idle (if API available)
    // For now, use default batch size
    return PROCESS_BATCH_SIZE;
}

// ============================================================================
// Privacy: Data Wipe
// ============================================================================

const WIPE_ALARM_NAME = 'privacy:wipe';

async function scheduleWipe(alsoRemoveModel: boolean = false, delayMs: number = 0): Promise<void> {
    console.log(`[Background] Scheduling wipe in ${delayMs}ms...`);

    if (delayMs > 0) {
        // Schedule alarm for delayed wipe
        await chrome.alarms.create(WIPE_ALARM_NAME, {
            when: Date.now() + delayMs
        });
        pendingWipeAlarm = WIPE_ALARM_NAME;

        // Store wipe settings
        await chrome.storage.local.set({
            pendingWipe: true,
            wipeRemoveModel: alsoRemoveModel
        });
    } else {
        // Execute immediately
        await executeWipe(alsoRemoveModel);
    }
}

async function cancelWipe(): Promise<void> {
    if (pendingWipeAlarm) {
        await chrome.alarms.clear(WIPE_ALARM_NAME);
        pendingWipeAlarm = null;
        await chrome.storage.local.remove(['pendingWipe', 'wipeRemoveModel']);
        console.log('[Background] Wipe cancelled');
    }
}

async function executeWipe(alsoRemoveModel: boolean): Promise<void> {
    console.log('[Background] Executing data wipe...');

    // Stop processing
    isProcessing = true; // Block new ticks

    try {
        // Close offscreen document
        await closeOffscreenIfIdle();

        // Wipe all data
        await wipeAllData(alsoRemoveModel);

        // Clear pending wipe state
        await chrome.storage.local.remove(['pendingWipe', 'wipeRemoveModel']);
        pendingWipeAlarm = null;

        // Broadcast completion
        chrome.runtime.sendMessage({ type: 'privacy:wipe:done' }).catch(() => {
            // Ignore errors if no listeners
        });

        console.log('[Background] Data wipe completed');
    } catch (error) {
        console.error('[Background] Wipe failed:', error);
        throw error;
    } finally {
        isProcessing = false;
    }
}

// ============================================================================
// Scheduler Tick (Main Processing Loop)
// ============================================================================

let isProcessing = false;
let pendingWipeAlarm: string | null = null;

async function runSchedulerTick(): Promise<void> {
    // Prevent concurrent processing
    if (isProcessing) {
        console.log('[Background] Already processing, skipping tick');
        return;
    }

    try {
        isProcessing = true;
        const startTime = Date.now();

        // Check gates
        if (await isPaused()) {
            console.log('[Background] Processing paused');
            return;
        }

        if (!(await isModelReady())) {
            console.log('[Background] Model not ready');
            return;
        }

        // Ensure offscreen is available
        await ensureOffscreen();

        // Dequeue batch
        const batchSize = getBatchSize();
        const jobs = await dequeueBatch(Date.now(), batchSize);

        if (jobs.length === 0) {
            console.log('[Background] No jobs to process');
            await closeOffscreenIfIdle();
            return;
        }

        // Filter jobs by privacy settings
        const settings = await chrome.storage.local.get(['paused', 'domainAllowlist', 'domainDenylist']);
        const filteredJobs = jobs.filter(job => !isHostBlocked(job.url, settings));

        if (filteredJobs.length === 0) {
            console.log('[Background] All jobs blocked by privacy settings');
            // Mark blocked jobs as done (skip them)
            for (const job of jobs) {
                await markSuccess(job.id);
            }
            await closeOffscreenIfIdle();
            return;
        }

        console.log(`[Background] Processing ${filteredJobs.length} jobs (${jobs.length - filteredJobs.length} blocked)`);

        // Send batch to offscreen
        const response = await chrome.runtime.sendMessage({
            type: 'ProcessBatch',
            jobs: filteredJobs.map((job) => ({
                url: job.url,
                title: job.title,
                description: job.description,
                payload: job.payload,
            })),
        } as BgMsgToOffscreen);

        // Handle response
        if (response && typeof response === 'object') {
            const result = response as OffscreenMsgToBg;

            if (result.type === 'BatchResult') {
                if (result.ok && 'results' in result) {
                    // Mark all as success
                    for (const jobResult of result.results) {
                        const job = filteredJobs.find((j) => j.url === jobResult.url);
                        if (job) {
                            await markSuccess(job.id);
                        }
                    }
                } else if (!result.ok && 'errors' in result) {
                    // Mark all as failure
                    for (const error of result.errors) {
                        const job = filteredJobs.find((j) => j.url === error.url);
                        if (job) {
                            const isRetriable = !error.message.includes('non-retriable');
                            await markFailure(job.id, error.message, isRetriable);
                        }
                    }
                }
            }
        }

        const elapsed = Date.now() - startTime;
        console.log(`[Background] Tick completed in ${elapsed}ms`);

        // Check if we should continue processing (respect time budget)
        if (elapsed < PROCESS_TIME_BUDGET_MS && jobs.length === batchSize) {
            // More work might be available, schedule another tick soon
            setTimeout(() => runSchedulerTick(), 100);
        }
    } catch (error) {
        console.error('[Background] Scheduler tick error:', error);
    } finally {
        isProcessing = false;
    }
}

// ============================================================================
// Runtime Listeners
// ============================================================================

// Install/Update
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('[Background] onInstalled:', details.reason);

    try {
        await openDb();
        await ensureAlarms();
        await initializeModelSystem(details.reason);
    } catch (error) {
        console.error('[Background] onInstalled error:', error);
    }
});

// Startup
chrome.runtime.onStartup.addListener(async () => {
    console.log('[Background] onStartup');

    try {
        await openDb();
        await ensureAlarms();
        await initializeModelSystem('startup');
        await runSchedulerTick();
    } catch (error) {
        console.error('[Background] onStartup error:', error);
    }
});

// Alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === ALARM_NAME) {
        console.log('[Background] Alarm triggered:', alarm.name);
        await runSchedulerTick();
    } else if (alarm.name === 'model-retry') {
        console.log('[Background] Model retry alarm triggered');
        await handleModelRetryAlarm();
    } else if (alarm.name === WIPE_ALARM_NAME) {
        console.log('[Background] Wipe alarm triggered');
        const { wipeRemoveModel } = await chrome.storage.local.get('wipeRemoveModel');
        await executeWipe(wipeRemoveModel ?? false);
    }
});

// Messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] Message received:', message, 'from:', sender);

    (async () => {
        try {
            // Handle messages from content scripts
            if ('type' in message) {
                const msg = message as BgMsgFromContent | OffscreenMsgToBg;

                switch (msg.type) {
                    case 'PageSeen': {
                        // Check if paused
                        if (await isPaused()) {
                            sendResponse({ type: 'Error', message: 'Processing is paused' } as BgMsgToContent);
                            return;
                        }

                        // Check privacy settings (allowlist/denylist)
                        const settings = await chrome.storage.local.get(['paused', 'domainAllowlist', 'domainDenylist']);
                        if (isHostBlocked(msg.url, settings)) {
                            sendResponse({ type: 'Error', message: 'URL blocked by privacy settings' } as BgMsgToContent);
                            return;
                        }

                        const id = await enqueuePageSeen(
                            msg.url,
                            msg.title,
                            msg.description,
                            msg.payload,
                            'content'
                        );

                        sendResponse({ type: 'Ack', id } as BgMsgToContent);

                        // Trigger immediate processing
                        setTimeout(() => runSchedulerTick(), 0);
                        break;
                    }

                    case 'TogglePause': {
                        await setPaused(msg.paused);
                        sendResponse({ type: 'Ack' } as BgMsgToContent);
                        break;
                    }

                    case 'ClearIndex': {
                        // Clear all queue items
                        const database = await openDb();
                        const tx = database.transaction([QUEUE_STORE], 'readwrite');
                        const store = tx.objectStore(QUEUE_STORE);
                        await new Promise<void>((resolve, reject) => {
                            const request = store.clear();
                            request.onsuccess = () => resolve();
                            request.onerror = () => reject(request.error);
                        });

                        sendResponse({ type: 'Ack' } as BgMsgToContent);
                        break;
                    }

                    case 'WorkerReady': {
                        // Offscreen worker is ready, we can set model version if not set
                        const modelVersion = await getSetting('modelVersion');
                        if (!modelVersion) {
                            await setSetting('modelVersion', '1.0.0');
                            console.log('[Background] Model version set after worker ready');
                        }
                        break;
                    }

                    case 'BatchResult': {
                        // Handled in runSchedulerTick response
                        break;
                    }

                    case 'CheckModelReady': {
                        // Check model readiness for offscreen document
                        const ready = await isModelReady();
                        sendResponse({ ready });
                        break;
                    }

                    case 'GetModelDebugInfo': {
                        // Get model debug info
                        const debugInfo = await getModelDebugInfo();
                        sendResponse(debugInfo);
                        break;
                    }

                    case 'settings:update': {
                        // Update settings
                        await updateSettings(msg.payload);
                        sendResponse({ type: 'Ack' } as BgMsgToContent);
                        break;
                    }

                    case 'privacy:wipe': {
                        // Schedule or execute data wipe
                        await scheduleWipe(msg.alsoRemoveModel ?? false, msg.delayMs ?? 0);
                        sendResponse({ type: 'Ack' } as BgMsgToContent);
                        break;
                    }

                    case 'privacy:wipe:cancel': {
                        // Cancel pending wipe
                        await cancelWipe();
                        sendResponse({ type: 'Ack' } as BgMsgToContent);
                        break;
                    }

                    default:
                        console.warn('[Background] Unknown message type:', (msg as any).type);
                }
            }
        } catch (error) {
            console.error('[Background] Message handler error:', error);
            sendResponse({ type: 'Error', message: String(error) } as BgMsgToContent);
        }
    })();

    // Return true to indicate async response
    return true;
});

// ============================================================================
// Initialization
// ============================================================================

console.log('[Background] Service worker loaded');

// Initialize on load (for existing installs)
(async () => {
    try {
        await openDb();
        await ensureAlarms();
    } catch (error) {
        console.error('[Background] Initialization error:', error);
    }
})();
