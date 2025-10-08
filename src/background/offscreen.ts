/**
 * Background offscreen module
 * Manages offscreen document lifecycle and provides API for communication
 */

import type {
    BridgeMessage,
    BridgeResponse,
    OffscreenAction
} from '../types/offscreen';

// Configuration
const OFFSCREEN_URL = 'src/offscreen/index.html';
const IDLE_TIMEOUT_MS = 90_000; // 90 seconds
const DEFAULT_TIMEOUT_MS = 60_000; // 60 seconds for requests

// State
let offscreenDocumentExists = false;
let activeRequestCount = 0;
let idleTimer: NodeJS.Timeout | null = null;
let creationPromise: Promise<void> | null = null;

// Pending requests map for correlation
const pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    onChunk?: (chunk: any) => void;
}>();

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
    return crypto.randomUUID();
}

/**
 * Reset idle timer
 */
function resetIdleTimer(): void {
    if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
    }

    // Only set idle timer if no active requests
    if (activeRequestCount === 0) {
        idleTimer = setTimeout(() => {
            console.log('[Offscreen] Idle timeout reached, shutting down');
            shutdownOffscreen({ force: false }).catch((err) => {
                console.error('[Offscreen] Failed to shutdown on idle:', err);
            });
        }, IDLE_TIMEOUT_MS);
    }
}

/**
 * Increment active request count
 */
function incrementActiveRequests(): void {
    activeRequestCount++;
    if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
    }
}

/**
 * Decrement active request count
 */
function decrementActiveRequests(): void {
    activeRequestCount = Math.max(0, activeRequestCount - 1);
    resetIdleTimer();
}

/**
 * Check if offscreen document exists
 */
async function hasOffscreenDocument(): Promise<boolean> {
    // For Chrome 109+
    if ('hasDocument' in chrome.offscreen) {
        return await chrome.offscreen.hasDocument();
    }

    // Fallback: track state manually
    return offscreenDocumentExists;
}

/**
 * Ensure offscreen document exists
 * Creates it if it doesn't exist, reuses if it does
 */
export async function ensureOffscreenDocument(): Promise<void> {
    // If already creating, wait for that promise
    if (creationPromise) {
        return creationPromise;
    }

    // Check if document already exists
    const exists = await hasOffscreenDocument();
    if (exists) {
        offscreenDocumentExists = true;
        return;
    }

    // Create new document
    creationPromise = (async () => {
        try {
            await chrome.offscreen.createDocument({
                url: OFFSCREEN_URL,
                reasons: [
                    chrome.offscreen.Reason.BLOBS,
                    chrome.offscreen.Reason.WORKERS
                ] as chrome.offscreen.Reason[],
                justification: 'Run embedding model in a dedicated Web Worker from an offscreen document. Requires BLOB processing for model artifacts and Worker for compute without UI.'
            });

            offscreenDocumentExists = true;
            console.log('[Offscreen] Document created');

            // Reset idle timer after creation
            resetIdleTimer();
        } catch (error) {
            offscreenDocumentExists = false;
            console.error('[Offscreen] Failed to create document:', error);
            throw error;
        } finally {
            creationPromise = null;
        }
    })();

    return creationPromise;
}

/**
 * Setup message listener for responses from offscreen
 */
function setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message: BridgeResponse, sender) => {
        // Only handle messages from offscreen document
        if (!sender.url?.includes(OFFSCREEN_URL)) {
            return;
        }

        const { requestId, ok, result, error, progress, final = true } = message;

        const pending = pendingRequests.get(requestId);
        if (!pending) {
            // No pending request found - might be a late response
            return;
        }

        // Handle streaming/progress updates
        if (progress && pending.onChunk) {
            pending.onChunk(progress);
        }

        // Handle intermediate results for streaming
        if (!final && result !== undefined && pending.onChunk) {
            pending.onChunk(result);
            return;
        }

        // Handle final response
        if (final || (!progress && (ok || error))) {
            // Clear timeout
            clearTimeout(pending.timeout);

            // Remove from pending
            pendingRequests.delete(requestId);
            decrementActiveRequests();

            // Resolve or reject
            if (ok) {
                pending.resolve(result);
            } else {
                const err = new Error(error?.message || 'Offscreen request failed');
                (err as any).code = error?.code;
                (err as any).details = error?.details;
                pending.reject(err);
            }
        }
    });
}

// Setup listener once
setupMessageListener();

/**
 * Send message to offscreen and wait for response
 */
export async function callOffscreen<TPayload = unknown, TResult = unknown>(
    action: OffscreenAction,
    payload?: TPayload,
    options: {
        timeout?: number;
        priority?: 'low' | 'normal' | 'high';
    } = {}
): Promise<TResult> {
    const requestId = generateRequestId();
    const timeout = options.timeout || DEFAULT_TIMEOUT_MS;

    // Ensure offscreen document exists
    await ensureOffscreenDocument();

    incrementActiveRequests();

    return new Promise<TResult>((resolve, reject) => {
        // Setup timeout
        const timeoutHandle = setTimeout(() => {
            if (pendingRequests.has(requestId)) {
                pendingRequests.delete(requestId);
                decrementActiveRequests();
                reject(new Error(`Offscreen request timed out after ${timeout}ms`));
            }
        }, timeout);

        // Store pending request
        pendingRequests.set(requestId, {
            resolve,
            reject,
            timeout: timeoutHandle
        });

        // Send message to offscreen
        const message: BridgeMessage<TPayload> = {
            requestId,
            action,
            payload,
            meta: {
                priority: options.priority
            }
        };

        chrome.runtime.sendMessage(message).catch((err) => {
            // If sending fails, cleanup and retry with document recreation
            if (pendingRequests.has(requestId)) {
                clearTimeout(timeoutHandle);
                pendingRequests.delete(requestId);
                decrementActiveRequests();

                // Mark document as not existing and retry
                offscreenDocumentExists = false;
                console.log('[Offscreen] Send failed, retrying with document recreation');

                // Retry once
                callOffscreen<TPayload, TResult>(action, payload, options)
                    .then(resolve)
                    .catch(reject);
            }
        });
    });
}

/**
 * Send message to offscreen with streaming support
 */
export async function callOffscreenStream<TPayload = unknown, TChunk = unknown>(
    action: OffscreenAction,
    payload: TPayload,
    onChunk: (chunk: TChunk) => void,
    options: {
        timeout?: number;
        priority?: 'low' | 'normal' | 'high';
    } = {}
): Promise<void> {
    const requestId = generateRequestId();
    const timeout = options.timeout || DEFAULT_TIMEOUT_MS;

    // Ensure offscreen document exists
    await ensureOffscreenDocument();

    incrementActiveRequests();

    return new Promise<void>((resolve, reject) => {
        // Setup timeout
        const timeoutHandle = setTimeout(() => {
            if (pendingRequests.has(requestId)) {
                pendingRequests.delete(requestId);
                decrementActiveRequests();
                reject(new Error(`Offscreen stream timed out after ${timeout}ms`));
            }
        }, timeout);

        // Store pending request with chunk handler
        pendingRequests.set(requestId, {
            resolve,
            reject,
            timeout: timeoutHandle,
            onChunk
        });

        // Send message to offscreen
        const message: BridgeMessage<TPayload> = {
            requestId,
            action,
            payload,
            meta: {
                streaming: true,
                priority: options.priority
            }
        };

        chrome.runtime.sendMessage(message).catch((err) => {
            if (pendingRequests.has(requestId)) {
                clearTimeout(timeoutHandle);
                pendingRequests.delete(requestId);
                decrementActiveRequests();
                reject(err);
            }
        });
    });
}

/**
 * Send fire-and-forget notification to offscreen
 */
export async function notifyOffscreen<TPayload = unknown>(
    action: OffscreenAction,
    payload?: TPayload
): Promise<void> {
    await ensureOffscreenDocument();

    const message: BridgeMessage<TPayload> = {
        requestId: generateRequestId(),
        action,
        payload
    };

    chrome.runtime.sendMessage(message).catch((err) => {
        console.error('[Offscreen] Failed to send notification:', err);
    });
}

/**
 * Shutdown offscreen document
 */
export async function shutdownOffscreen(options: {
    force?: boolean;
} = {}): Promise<void> {
    const { force = false } = options;

    // If force, clear all pending requests
    if (force) {
        for (const [requestId, pending] of pendingRequests.entries()) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Offscreen shutdown forced'));
        }
        pendingRequests.clear();
        activeRequestCount = 0;
    }

    // Don't shutdown if there are active requests (unless forced)
    if (activeRequestCount > 0 && !force) {
        console.log('[Offscreen] Cannot shutdown, active requests:', activeRequestCount);
        return;
    }

    // Clear idle timer
    if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
    }

    // Check if document exists
    const exists = await hasOffscreenDocument();
    if (!exists) {
        offscreenDocumentExists = false;
        return;
    }

    try {
        // Send CLOSE message to offscreen
        await notifyOffscreen('CLOSE');

        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));

        // Close document
        await chrome.offscreen.closeDocument();
        offscreenDocumentExists = false;
        console.log('[Offscreen] Document closed');
    } catch (error) {
        offscreenDocumentExists = false;
        console.error('[Offscreen] Failed to close document:', error);
        throw error;
    }
}

/**
 * Get current offscreen status
 */
export function getOffscreenStatus(): {
    exists: boolean;
    activeRequests: number;
    pendingRequests: number;
} {
    return {
        exists: offscreenDocumentExists,
        activeRequests: activeRequestCount,
        pendingRequests: pendingRequests.size
    };
}

/**
 * Ping offscreen to check if it's ready
 */
export async function pingOffscreen(): Promise<{ now: number; ready: boolean }> {
    return callOffscreen('PING');
}
