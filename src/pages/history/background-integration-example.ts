/**
 * Example Background Service Worker Integration for History Search
 * 
 * This file shows how to handle history search messages and Port connections
 * in the background service worker to support the History Search Page.
 */

import type { HistoryMessage, HistoryResponse, SearchPortMessage, HistoryResultGroup } from './types';

// ============================================================================
// Settings Message Handlers
// ============================================================================

/**
 * Handle settings-related messages from the history page
 */
export async function handleHistorySettingsMessage(
    message: HistoryMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: HistoryResponse) => void
): Promise<boolean> {

    switch (message.type) {
        case 'GET_SETTINGS': {
            try {
                // Fetch settings from storage or state
                const modelReady = await isModelReady(); // Your model ready check
                const paused = await getStoredSetting('paused', false);
                const domainAllowlist = await getStoredSetting('domainAllowlist', []);
                const domainDenylist = await getStoredSetting('domainDenylist', []);

                sendResponse({
                    type: 'SETTINGS',
                    data: {
                        modelReady,
                        paused,
                        domainAllowlist,
                        domainDenylist,
                    },
                });
            } catch (error) {
                sendResponse({
                    type: 'ERROR',
                    code: 'SETTINGS_LOAD_FAILED',
                    message: error instanceof Error ? error.message : 'Failed to load settings',
                });
            }
            return true; // Async response
        }

        case 'SET_PAUSED': {
            try {
                await setStoredSetting('paused', message.paused);
                sendResponse({ type: 'CLEAR_OK' });
            } catch (error) {
                sendResponse({
                    type: 'ERROR',
                    code: 'PAUSE_UPDATE_FAILED',
                    message: error instanceof Error ? error.message : 'Failed to update pause state',
                });
            }
            return true;
        }

        case 'CLEAR_INDEX': {
            try {
                // Clear your IndexedDB or MiniSearch index
                await clearSearchIndex();
                await clearHistoryChunks();
                sendResponse({ type: 'CLEAR_OK' });
            } catch (error) {
                sendResponse({
                    type: 'ERROR',
                    code: 'CLEAR_FAILED',
                    message: error instanceof Error ? error.message : 'Failed to clear index',
                });
            }
            return true;
        }

        case 'UPDATE_FILTERS': {
            try {
                if (message.allowlist !== undefined) {
                    await setStoredSetting('domainAllowlist', message.allowlist);
                }
                if (message.denylist !== undefined) {
                    await setStoredSetting('domainDenylist', message.denylist);
                }
                sendResponse({ type: 'CLEAR_OK' });
            } catch (error) {
                sendResponse({
                    type: 'ERROR',
                    code: 'FILTER_UPDATE_FAILED',
                    message: error instanceof Error ? error.message : 'Failed to update filters',
                });
            }
            return true;
        }

        default:
            return false; // Not handled
    }
}

// ============================================================================
// Search Port Handler
// ============================================================================

/**
 * Handle Port connection for streaming search results
 */
export function handleHistorySearchPort(port: chrome.runtime.Port): void {
    if (port.name !== 'history-search') return;

    console.log('[Background] History search port connected');

    port.onMessage.addListener(async (msg: SearchPortMessage) => {
        if (msg.type === 'SEARCH') {
            try {
                await performHistorySearch(msg.payload, port);
            } catch (error) {
                port.postMessage({
                    type: 'SEARCH_ERROR',
                    message: error instanceof Error ? error.message : 'Search failed',
                } as SearchPortMessage);
            }
        }
    });

    port.onDisconnect.addListener(() => {
        console.log('[Background] History search port disconnected');
    });
}

/**
 * Perform the actual search and stream results back through the port
 */
async function performHistorySearch(
    filters: {
        query: string;
        dateRange: { start: number | null; end: number | null };
        domains: string[];
        limit?: number;
        offset?: number;
    },
    port: chrome.runtime.Port
): Promise<void> {
    const { query, dateRange, domains, limit = 200, offset = 0 } = filters;

    console.log('[Background] Performing search:', { query, dateRange, domains, limit, offset });

    // Example implementation using MiniSearch or your search backend
    // This is a placeholder - implement your actual search logic here

    try {
        // Step 1: Query your search index (MiniSearch, Dexie, etc.)
        const results = await querySearchIndex({
            query,
            dateStart: dateRange.start,
            dateEnd: dateRange.end,
            domains,
            limit,
            offset,
        });

        // Step 2: Group results by domain
        const grouped = groupResultsByDomain(results);

        // Step 3: Stream results in chunks (optional, for large result sets)
        const CHUNK_SIZE = 50;
        const groups = Array.from(grouped.values());
        const totalResults = results.length;

        for (let i = 0; i < groups.length; i += CHUNK_SIZE) {
            const chunk = groups.slice(i, i + CHUNK_SIZE);
            const isFinal = i + CHUNK_SIZE >= groups.length;

            port.postMessage({
                type: 'SEARCH_RESULT',
                chunk,
                total: totalResults,
                final: isFinal,
            } as SearchPortMessage);

            // Small delay between chunks to avoid blocking
            if (!isFinal) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        // Step 4: Send completion message
        port.postMessage({
            type: 'SEARCH_DONE',
        } as SearchPortMessage);

    } catch (error) {
        console.error('[Background] Search error:', error);
        port.postMessage({
            type: 'SEARCH_ERROR',
            message: error instanceof Error ? error.message : 'Search failed',
        } as SearchPortMessage);
    }
}

// ============================================================================
// Helper Functions (Implement These Based on Your DB)
// ============================================================================

/**
 * Query your search index (MiniSearch, full-text search, vector search, etc.)
 */
async function querySearchIndex(params: {
    query: string;
    dateStart: number | null;
    dateEnd: number | null;
    domains: string[];
    limit: number;
    offset: number;
}): Promise<any[]> {
    // TODO: Implement your actual search logic here
    // Example with MiniSearch:
    // const miniSearch = await loadMiniSearchIndex();
    // const results = miniSearch.search(params.query, { 
    //   filter: (result) => {
    //     // Apply date and domain filters
    //     return true;
    //   }
    // });
    // return results;

    // Placeholder
    return [];
}

/**
 * Group search results by domain
 */
function groupResultsByDomain(results: any[]): Map<string, HistoryResultGroup> {
    const groups = new Map<string, HistoryResultGroup>();

    for (const result of results) {
        const url = new URL(result.url);
        const domain = url.hostname;

        if (!groups.has(domain)) {
            groups.set(domain, {
                domain,
                favicon: `https://www.google.com/s2/favicons?domain=${domain}`,
                items: [],
                totalItems: 0,
                isExpanded: false,
            });
        }

        const group = groups.get(domain)!;
        group.items.push({
            id: result.id,
            url: result.url,
            title: result.title || 'Untitled',
            snippet: result.text?.slice(0, 200) || '',
            visitedAt: result.timestamp || Date.now(),
            favicon: `https://www.google.com/s2/favicons?domain=${domain}`,
            score: result.score,
        });
        group.totalItems = group.items.length;
    }

    return groups;
}

/**
 * Check if the AI model is ready for search
 */
async function isModelReady(): Promise<boolean> {
    // TODO: Implement your model readiness check
    // This might check if embeddings are initialized, model is downloaded, etc.
    return true;
}

/**
 * Get a setting from chrome.storage.local
 */
async function getStoredSetting<T>(key: string, defaultValue: T): Promise<T> {
    const result = await chrome.storage.local.get(key);
    return result[key] !== undefined ? result[key] : defaultValue;
}

/**
 * Set a setting in chrome.storage.local
 */
async function setStoredSetting(key: string, value: any): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
}

/**
 * Clear the search index
 */
async function clearSearchIndex(): Promise<void> {
    // TODO: Clear your MiniSearch or other search index
    // Example:
    // const db = await openDatabase();
    // await db.clear('miniSearchIndex');
}

/**
 * Clear history chunks from IndexedDB
 */
async function clearHistoryChunks(): Promise<void> {
    // TODO: Clear your history chunks from IndexedDB
    // Example:
    // const db = await openDatabase();
    // await db.clear('chunks');
    // await db.clear('pages');
}

// ============================================================================
// Registration (Add to your main background.ts)
// ============================================================================

// In your background.ts, add these listeners:

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Check if this is a history settings message
    if (message.type === 'GET_SETTINGS' ||
        message.type === 'SET_PAUSED' ||
        message.type === 'CLEAR_INDEX' ||
        message.type === 'UPDATE_FILTERS') {
        handleHistorySettingsMessage(message, sender, sendResponse);
        return true; // Async response
    }

    // ... your other message handlers
});

// Port listener
chrome.runtime.onConnect.addListener((port) => {
    handleHistorySearchPort(port);
});
