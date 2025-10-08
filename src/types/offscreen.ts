/**
 * Message protocol types for offscreen document + worker bridge
 */

export type Priority = 'low' | 'normal' | 'high';

export interface BridgeMessage<T = unknown> {
    requestId: string; // uuid or nanoid
    action: string;    // e.g., 'INIT_MODEL', 'EMBED_TEXT_BATCH', 'SEARCH', 'CLOSE', 'PING'
    payload?: T;
    meta?: {
        streaming?: boolean;
        priority?: Priority;
    };
}

export interface BridgeError {
    code: string;
    message: string;
    details?: unknown;
}

export interface BridgeProgress {
    done: number;
    total?: number;
}

export interface BridgeResponse<T = unknown> {
    requestId: string;
    ok: boolean;
    result?: T;
    error?: BridgeError;
    progress?: BridgeProgress; // optional for streaming
    final?: boolean; // true on last chunk or single response
}

/**
 * Offscreen document actions
 */
export type OffscreenAction =
    | 'PING'
    | 'INIT_MODEL'
    | 'EMBED_TEXT'
    | 'EMBED_TEXT_BATCH'
    | 'SEARCH_HYBRID'
    | 'MINISEARCH_INIT'
    | 'MINISEARCH_ADD_OR_UPDATE'
    | 'MINISEARCH_REMOVE'
    | 'MINISEARCH_SEARCH'
    | 'MINISEARCH_PERSIST'
    | 'MINISEARCH_STATS'
    | 'MINISEARCH_REBUILD'
    | 'MINISEARCH_CLEAR'
    | 'CLOSE';

/**
 * Payload types for specific actions
 */
export interface PingPayload { }

export interface InitModelPayload {
    modelUrl?: string;
    config?: Record<string, unknown>;
}

export interface EmbedTextPayload {
    text: string;
}

export interface EmbedTextBatchPayload {
    texts: string[];
    chunkSize?: number;
}

export interface SearchHybridPayload {
    query: string;
    limit?: number;
    filters?: Record<string, unknown>;
}

export interface MiniSearchDoc {
    id: string;
    url: string;
    title: string;
    text: string;
}

export interface MiniSearchInitPayload {
    options?: Record<string, unknown>;
}

export interface MiniSearchAddOrUpdatePayload {
    docs: MiniSearchDoc[];
}

export interface MiniSearchRemovePayload {
    ids: string[];
}

export interface MiniSearchSearchPayload {
    query: string;
    options?: Record<string, unknown>;
}

export interface MiniSearchPersistPayload {
    force?: boolean;
}

export interface MiniSearchRebuildPayload {
    // No payload needed - uses iterateAllPages from db
}

/**
 * Result types for specific actions
 */
export interface PingResult {
    now: number;
    ready: boolean;
}

export interface InitModelResult {
    success: boolean;
    modelInfo?: {
        name: string;
        dimensions: number;
    };
}

export interface EmbedTextResult {
    embedding: number[];
    dimensions: number;
}

export interface EmbedTextBatchResult {
    embeddings: number[][];
    dimensions: number;
}

export interface SearchHybridResult {
    results: Array<{
        id: string;
        score: number;
        content: string;
    }>;
}

export interface MiniSearchSearchResult {
    id: string;
    url: string;
    title: string;
    text: string;
    score: number;
    match?: Record<string, string[]>;
}

export interface MiniSearchStatsResult {
    docCount: number;
    approxBytes: number;
    lastPersistedAt: number;
    needsRebuild: boolean;
}
