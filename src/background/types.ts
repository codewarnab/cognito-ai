/**
 * Type definitions for background service worker
 */

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
    | { type: 'GetIndexStats' }
    | { type: 'GET_SETTINGS' }
    | { type: 'SET_PAUSED'; paused: boolean }
    | { type: 'UPDATE_FILTERS'; allowlist?: string[]; denylist?: string[] }
    | { type: 'CLEAR_INDEX' }
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
