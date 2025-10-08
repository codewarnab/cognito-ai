/**
 * Offscreen bridge - runs in offscreen document
 * Manages a dedicated Web Worker and routes messages between background and worker
 * Also handles MiniSearch operations directly in the offscreen context
 */

import type { BridgeMessage, BridgeResponse } from '../types/offscreen';
import * as miniSearch from '../search/minisearch';

// Import model readiness check from background context
// Note: In offscreen context, we check via messaging to background
let worker: Worker | null = null;
let workerReady = false;
let miniSearchReady = false;

/**
 * Check if model is ready by messaging background
 */
async function checkModelReady(): Promise<boolean> {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'CheckModelReady' });
        return response?.ready ?? false;
    } catch (error) {
        console.error('[Offscreen Bridge] Failed to check model readiness:', error);
        return false;
    }
}

/**
 * Ensure the worker is started
 */
async function ensureWorker(): Promise<void> {
    if (worker) return;

    // Check if model is ready before starting worker
    const modelReady = await checkModelReady();
    if (!modelReady) {
        throw new Error('Model not ready - assets may still be downloading');
    }

    try {
        // Create worker from extension URL
        const workerUrl = chrome.runtime.getURL('workers/embed-worker.js');
        worker = new Worker(workerUrl, { type: 'module' });

        // Forward worker messages back to background
        worker.onmessage = (event: MessageEvent<BridgeResponse>) => {
            chrome.runtime.sendMessage(event.data).catch((err) => {
                console.error('Failed to send worker message to background:', err);
            });
        };

        // Handle worker errors
        worker.onerror = (error) => {
            console.error('Worker error:', error);
            workerReady = false;

            // Send error response to background if we have context
            chrome.runtime.sendMessage({
                ok: false,
                error: {
                    code: 'WORKER_ERROR',
                    message: error.message || 'Worker encountered an error',
                    details: error
                }
            } as BridgeResponse).catch((err) => {
                console.error('Failed to send worker error to background:', err);
            });
        };

        console.log('[Offscreen Bridge] Worker started');
    } catch (error) {
        console.error('[Offscreen Bridge] Failed to start worker:', error);
        throw error;
    }
}

/**
 * Terminate the worker
 */
function terminateWorker(): void {
    if (worker) {
        worker.terminate();
        worker = null;
        workerReady = false;
        console.log('[Offscreen Bridge] Worker terminated');
    }
}

/**
 * Handle MiniSearch actions in the offscreen context
 */
async function handleMiniSearchAction(message: BridgeMessage): Promise<any> {
    const { action, payload } = message;

    switch (action) {
        case 'MINISEARCH_INIT':
            await miniSearch.initMiniSearch((payload as any)?.options);
            miniSearchReady = true;
            return { success: true };

        case 'MINISEARCH_ADD_OR_UPDATE':
            if (!(payload as any)?.docs) {
                throw new Error('Missing docs payload');
            }
            await miniSearch.addOrUpdateDocs((payload as any).docs);
            return { success: true, count: (payload as any).docs.length };

        case 'MINISEARCH_REMOVE':
            if (!(payload as any)?.ids) {
                throw new Error('Missing ids payload');
            }
            await miniSearch.removeDocs((payload as any).ids);
            return { success: true, count: (payload as any).ids.length };

        case 'MINISEARCH_SEARCH':
            if (!(payload as any)?.query) {
                throw new Error('Missing query payload');
            }
            const results = await miniSearch.search((payload as any).query, (payload as any).options);
            return { results };

        case 'MINISEARCH_PERSIST':
            await miniSearch.persist((payload as any)?.force || false);
            return { success: true };

        case 'MINISEARCH_STATS':
            const stats = await miniSearch.getStats();
            return stats;

        case 'MINISEARCH_REBUILD':
            await miniSearch.rebuildFromPages();
            return { success: true };

        case 'MINISEARCH_CLEAR':
            await miniSearch.clearIndex();
            return { success: true };

        default:
            throw new Error(`Unknown MiniSearch action: ${action}`);
    }
}

/**
 * Handle messages from background
 */
chrome.runtime.onMessage.addListener((message: BridgeMessage, sender, sendResponse) => {
    (async () => {
        try {
            // Handle PING action directly (check if worker is ready)
            if (message.action === 'PING') {
                const response: BridgeResponse = {
                    requestId: message.requestId,
                    ok: true,
                    result: {
                        now: Date.now(),
                        ready: workerReady,
                        miniSearchReady
                    },
                    final: true
                };
                chrome.runtime.sendMessage(response);
                return;
            }

            // Handle CLOSE action - terminate worker and close offscreen
            if (message.action === 'CLOSE') {
                terminateWorker();

                const response: BridgeResponse = {
                    requestId: message.requestId,
                    ok: true,
                    result: { closed: true },
                    final: true
                };
                chrome.runtime.sendMessage(response);

                // Close the offscreen document
                self.close();
                return;
            }

            // Handle MiniSearch actions directly in offscreen context
            if (message.action.startsWith('MINISEARCH_')) {
                const result = await handleMiniSearchAction(message);
                const response: BridgeResponse = {
                    requestId: message.requestId,
                    ok: true,
                    result,
                    final: true
                };
                chrome.runtime.sendMessage(response);
                return;
            }

            // For all other actions, ensure worker is running and forward the message
            await ensureWorker();

            if (!worker) {
                throw new Error('Worker not available');
            }

            // Handle INIT_MODEL to track readiness
            if (message.action === 'INIT_MODEL') {
                // Listen for initialization response to set ready flag
                const initHandler = (event: MessageEvent<BridgeResponse>) => {
                    if (event.data.requestId === message.requestId && event.data.ok) {
                        workerReady = true;
                        worker?.removeEventListener('message', initHandler);
                    }
                };
                worker.addEventListener('message', initHandler);
            }

            // Forward message to worker
            worker.postMessage(message);

        } catch (error) {
            console.error('[Offscreen Bridge] Error handling message:', error);

            // Send error response
            const errorResponse: BridgeResponse = {
                requestId: message.requestId,
                ok: false,
                error: {
                    code: 'BRIDGE_ERROR',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    details: error
                },
                final: true
            };
            chrome.runtime.sendMessage(errorResponse);
        }
    })();

    // Return true to indicate async response
    return true;
});

/**
 * Cleanup on unload
 */
self.addEventListener('beforeunload', () => {
    console.log('[Offscreen Bridge] Unloading, terminating worker');
    terminateWorker();
});

console.log('[Offscreen Bridge] Initialized and ready');

// Initialize MiniSearch on startup
(async () => {
    try {
        await miniSearch.initMiniSearch();
        miniSearchReady = true;
        console.log('[Offscreen Bridge] MiniSearch initialized');
    } catch (error) {
        console.error('[Offscreen Bridge] Failed to initialize MiniSearch:', error);
    }
})();
