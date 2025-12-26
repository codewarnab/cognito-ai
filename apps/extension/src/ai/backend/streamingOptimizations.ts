/**
 * Streaming Optimizations
 *
 * - Connection pooling
 * - Request deduplication
 * - Abort handling
 */

import { createLogger } from '~logger';

const log = createLogger('StreamOptimizer', 'AI_CHAT_STREAM');

// Keep-alive connection for backend
let backendController: AbortController | null = null;

/**
 * Create optimized fetch for streaming
 */
export function createOptimizedFetch() {
    return (url: string, options: RequestInit): Promise<Response> => {
        // Add keep-alive headers
        const headers = new Headers(options.headers);
        headers.set('Connection', 'keep-alive');

        return fetch(url, {
            ...options,
            headers,
            // Enable streaming duplex mode
            // @ts-expect-error - duplex is experimental but supported
            duplex: 'half',
        });
    };
}

/**
 * Abort any in-flight backend request
 */
export function abortBackendRequest(): void {
    if (backendController) {
        log.info('Aborting in-flight backend request');
        backendController.abort();
        backendController = null;
    }
}

/**
 * Create new abort controller for backend request
 */
export function createBackendController(): AbortController {
    abortBackendRequest();
    backendController = new AbortController();
    return backendController;
}

/**
 * Get current abort controller
 */
export function getBackendController(): AbortController | null {
    return backendController;
}

/**
 * Clear the current abort controller without aborting
 */
export function clearBackendController(): void {
    backendController = null;
}

/**
 * Request deduplication cache
 * Prevents duplicate requests within a short window
 */
const pendingRequests = new Map<string, Promise<Response>>();
const DEDUP_WINDOW_MS = 100;

/**
 * Create a cache key for request deduplication
 */
function createCacheKey(url: string, body: string): string {
    return `${url}:${body}`;
}

/**
 * Deduplicated fetch - prevents duplicate requests within a short window
 */
export async function deduplicatedFetch(
    url: string,
    options: RequestInit
): Promise<Response> {
    const body = typeof options.body === 'string' ? options.body : '';
    const cacheKey = createCacheKey(url, body);

    // Check for pending request
    const pending = pendingRequests.get(cacheKey);
    if (pending) {
        log.debug('Reusing pending request:', cacheKey.substring(0, 50));
        return pending.then((r) => r.clone());
    }

    // Create new request
    const fetchPromise = fetch(url, options);

    // Cache the promise briefly
    pendingRequests.set(cacheKey, fetchPromise);

    // Clean up after window
    setTimeout(() => {
        pendingRequests.delete(cacheKey);
    }, DEDUP_WINDOW_MS);

    return fetchPromise;
}

/**
 * Measure time to first byte (TTFB)
 */
export async function measureTTFB(
    fetchFn: () => Promise<Response>
): Promise<{ response: Response; ttfb: number }> {
    const startTime = performance.now();
    const response = await fetchFn();
    const ttfb = performance.now() - startTime;

    log.debug('TTFB measured:', { ttfb: `${ttfb.toFixed(0)}ms` });

    return { response, ttfb };
}
