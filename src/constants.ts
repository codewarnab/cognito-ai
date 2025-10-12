/**
 * Database configuration constants for IndexedDB storage management
 */

// Quota and eviction thresholds
export const DB_CAPS = {
    /** Maximum chunks to keep per page */
    MAX_CHUNKS_PER_PAGE: 50,

    /** Global maximum number of pages before triggering eviction */
    MAX_PAGES: 10000,

    /** Global maximum number of chunks before triggering eviction */
    MAX_CHUNKS: 100000,

    /** Number of records to process in a single bulk operation */
    BULK_BATCH_SIZE: 1000,

    /** Percentage of items to evict when over quota (e.g., 0.2 = remove 20% oldest) */
    EVICTION_PERCENTAGE: 0.2,
} as const;

// Database settings keys
export const SETTINGS_KEYS = {
    TOTAL_CHUNK_COUNT: 'totalChunkCount',
    TOTAL_PAGE_COUNT: 'totalPageCount',
    LAST_EVICTION_TIMESTAMP: 'lastEvictionTimestamp',
    MINISEARCH_VERSION: 'miniSearchVersion',
} as const;

// Queue types
export const QUEUE_TYPES = {
    EMBEDDING: 'embedding',
    INDEXING: 'indexing',
    SCREENSHOT: 'screenshot',
    CLEANUP: 'cleanup',
} as const;

// Queue status
export const QUEUE_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    DONE: 'done',
    FAILED: 'failed',
} as const;

// Model download and caching
// Load from local extension bundle instead of CDN
export const MODEL_BASE_URL = typeof chrome !== 'undefined' && chrome.runtime
    ? chrome.runtime.getURL('models')
    : 'models'; // Fallback for non-extension context
export const MODEL_VERSION = '1.0.0';
export const MODEL_CACHE_PREFIX = 'model/';

// Model bootstrap states
export const MODEL_BOOTSTRAP_STATES = {
    IDLE: 'idle',
    CHECKING: 'checking',
    DOWNLOADING: 'downloading',
    VERIFYING: 'verifying',
    READY: 'ready',
    ERROR: 'error',
} as const;

// Model retry configuration
export const MODEL_RETRY = {
    /** Initial backoff delay in minutes */
    INITIAL_BACKOFF_MINUTES: 1,
    /** Maximum backoff delay in minutes */
    MAX_BACKOFF_MINUTES: 60,
    /** Maximum number of retry attempts */
    MAX_ATTEMPTS: 10,
    /** Backoff multiplier */
    BACKOFF_MULTIPLIER: 2,
} as const;

// Model storage keys
export const MODEL_STORAGE_KEYS = {
    VERSION: 'model.version',
    READY: 'model.ready',
    BOOTSTRAP_STATE: 'model.bootstrapState',
    ERROR: 'model.error',
    LAST_CHECK_AT: 'model.lastCheckAt',
    PENDING_VERSION: 'model.pendingVersion',
    ASSET_ETAGS: 'model.assetETags',
    RETRY_COUNT: 'model.retryCount',
} as const;

// Model asset manifest schema
export interface ModelAsset {
    path: string;
    size: number;
    sha256: string;
    optional?: boolean;
}

export interface ModelManifest {
    version: string;
    assets: ModelAsset[];
    expires?: string;
    minAppVersion?: string;
}

export interface ModelError {
    code: string;
    message: string;
    at: number;
}

export type ModelBootstrapState = typeof MODEL_BOOTSTRAP_STATES[keyof typeof MODEL_BOOTSTRAP_STATES];

// Chrome Built-in AI (Gemini Nano) limits
// Based on Chrome AI documentation and community reports
export const CHROME_AI_LIMITS = {
    /** Maximum tokens per single prompt to Gemini Nano (on-device model) */
    MAX_TOKENS_PER_PROMPT: 1024,

    /** Maximum tokens for session retention (sliding window) */
    MAX_TOKENS_PER_SESSION: 4096,

    /** Recommended chunk size for text processing to stay well under prompt limit */
    RECOMMENDED_CHUNK_TOKENS: 800,

    /** Maximum output tokens per response */
    MAX_OUTPUT_TOKENS: 1024,
} as const;

// MiniSearch sparse index configuration
export const MINISEARCH_CONFIG = {
    /** Index version - bump to trigger rebuild when tokenization/scoring changes */
    INDEX_VERSION: 1,

    /** Persist index to IndexedDB every N mutations (adds/updates/removes) */
    PERSIST_EVERY_N: 10,

    /** 
     * Maximum tokens per text field to prevent excessive index size
     * Note: This is for the search index only, not for Chrome AI prompts
     * For Chrome AI processing, use CHROME_AI_LIMITS.RECOMMENDED_CHUNK_TOKENS
     */
    TRUNCATION_TOKENS: 2000,

    /** Maximum serialized index size in bytes (~20MB) */
    SIZE_CAP_BYTES: 20 * 1024 * 1024,

    /** Fields to index for search */
    INDEX_FIELDS: ['title', 'text'],

    /** Fields to store in the index */
    STORE_FIELDS: ['id', 'url', 'title', 'text'],

    /** Search options */
    SEARCH_OPTIONS: {
        prefix: true,
        fuzzy: 0.2,
        boost: { title: 2.0 },
    },
} as const;
