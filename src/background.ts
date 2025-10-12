/**
 * MV3 Background Service Worker - Main Entry Point
 * 
 * Orchestrates:
 * - Persistent FIFO queue with coalescing (IndexedDB)
 * - Alarm-based scheduling with budgets
 * - Offscreen document lifecycle
 * - Model readiness gating
 * - Exponential backoff and retry logic
 * - Message routing between content/offscreen/worker
 */

// Database initialization
import { openDb } from './background/database';

// Model system
import { initializeModelSystem, handleModelRetryAlarm } from './background/model-ready';

// Alarm management
import { ensureAlarms, getSchedulerAlarmName } from './background/alarms';

// Scheduler
import { runSchedulerTick } from './background/scheduler';

// Privacy controls
import { executeWipe, getWipeAlarmName } from './background/privacy';

// Message handling
import { handleMessage } from './background/message-handler';

// Search functionality
import { search, initMiniSearch, getStats } from './search/minisearch';

// ============================================================================
// Runtime Listeners
// ============================================================================

/**
 * Extension install/update handler
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('[Background] onInstalled:', details.reason);

    try {
        await openDb();
        await initMiniSearch();
        await ensureAlarms();
        await initializeModelSystem(details.reason);
        
        // Enable side panel on all existing tabs
        if (chrome.sidePanel) {
            chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
        }
    } catch (error) {
        console.error('[Background] onInstalled error:', error);
    }
});

/**
 * Extension startup handler
 */
chrome.runtime.onStartup.addListener(async () => {
    console.log('[Background] onStartup');

    try {
        await openDb();
        await initMiniSearch();
        await ensureAlarms();
        await initializeModelSystem('startup');
        await runSchedulerTick();
    } catch (error) {
        console.error('[Background] onStartup error:', error);
    }
});

/**
 * Alarm handler
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
    const schedulerAlarmName = getSchedulerAlarmName();
    const wipeAlarmName = getWipeAlarmName();

    if (alarm.name === schedulerAlarmName) {
        console.log('[Background] Alarm triggered:', alarm.name);
        await runSchedulerTick();
    } else if (alarm.name === 'model-retry') {
        console.log('[Background] Model retry alarm triggered');
        await handleModelRetryAlarm();
    } else if (alarm.name === wipeAlarmName) {
        console.log('[Background] Wipe alarm triggered');
        const { wipeRemoveModel } = await chrome.storage.local.get('wipeRemoveModel');
        await executeWipe(wipeRemoveModel ?? false);
    }
});

/**
 * Action click handler - open side panel
 */
if (chrome.action) {
    chrome.action.onClicked.addListener(async (tab) => {
        if (chrome.sidePanel && tab.id) {
            try {
                await chrome.sidePanel.open({ tabId: tab.id });
            } catch (error) {
                console.error('[Background] Error opening side panel:', error);
            }
        }
    });
}

/**
 * Message handler
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    // Return true to indicate async response
    return true;
});

/**
 * Port connection handler for history search
 */
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'history-search') {
        console.log('[Background] History search port connected');
        
        port.onMessage.addListener(async (message) => {
            try {
                if (message.type === 'SEARCH') {
                    await handleHistorySearch(message.payload, port);
                }
            } catch (error) {
                console.error('[Background] History search error:', error);
                port.postMessage({
                    type: 'SEARCH_ERROR',
                    message: String(error)
                });
            }
        });

        port.onDisconnect.addListener(() => {
            console.log('[Background] History search port disconnected');
        });
    }
});

// ============================================================================
// History Search Handler
// ============================================================================

/**
 * Handle history search requests
 */
async function handleHistorySearch(filters: any, port: chrome.runtime.Port): Promise<void> {
    const { query, dateRange, domains, limit = 200, offset = 0 } = filters;
    
    console.log('[Background] Performing history search:', { query, dateRange, domains, limit, offset });
    
    try {
        // Ensure index is initialized
        await initMiniSearch();
        
        // Check index stats
        const stats = await getStats();
        console.log('[Background] Index stats:', stats);
        
        if (stats.docCount === 0) {
            console.warn('[Background] Index is empty - no documents to search');
            port.postMessage({
                type: 'SEARCH_RESULT',
                chunk: [],
                total: 0,
                final: true
            });
            port.postMessage({
                type: 'SEARCH_DONE'
            });
            return;
        }
        
        // Perform search using MiniSearch
        const results = await search(query, { limit });
        console.log(`[Background] Search returned ${results.length} results`);
        [{
	"resource": "/c:/Users/User/code/hackathons/chrome-ai/src/background.ts",
	"owner": "typescript",
	"code": "2339",
	"severity": 8,
	"message": "Property 'snippet' does not exist on type 'MiniSearchSearchResult'.",
	"source": "ts",
	"startLineNumber": 153,
	"startColumn": 33,
	"endLineNumber": 153,
	"endColumn": 40,
	"modelVersionId": 8
},{
	"resource": "/c:/Users/User/code/hackathons/chrome-ai/src/background.ts",
	"owner": "typescript",
	"code": "2339",
	"severity": 8,
	"message": "Property 'timestamp' does not exist on type 'MiniSearchSearchResult'.",
	"source": "ts",
	"startLineNumber": 154,
	"startColumn": 35,
	"endLineNumber": 154,
	"endColumn": 44,
	"modelVersionId": 8
}]
        // Group results by domain
        const grouped = new Map<string, any[]>();
        
        for (const result of results) {
            const domain = new URL(result.url).hostname;
            if (!grouped.has(domain)) {
                grouped.set(domain, []);
            }
            grouped.get(domain)!.push({
                id: result.id,
                title: result.title || 'Untitled',
                url: result.url,
                snippet: result.text || '',
                visitedAt: Date.now() // MiniSearch doesn't store timestamps, use current time
            });
        }
        
        // Convert to array format expected by frontend
        const groups = Array.from(grouped.entries()).map(([domain, items]) => ({
            domain,
            totalItems: items.length,
            items: items.slice(0, 10), // Limit items per group
            favicon: `https://www.google.com/s2/favicons?domain=${domain}`,
            isExpanded: false
        }));
        
        // Send results back through port
        port.postMessage({
            type: 'SEARCH_RESULT',
            chunk: groups,
            total: results.length,
            final: true
        });
        
        port.postMessage({
            type: 'SEARCH_DONE'
        });
        
    } catch (error) {
        console.error('[Background] Search error:', error);
        port.postMessage({
            type: 'SEARCH_ERROR',
            message: String(error)
        });
    }
}

// ============================================================================
// Initialization
// ============================================================================

console.log('[Background] Service worker loaded');

// Initialize on load (for existing installs)
(async () => {
    try {
        await openDb();
        await initMiniSearch();
        await ensureAlarms();
    } catch (error) {
        console.error('[Background] Initialization error:', error);
    }
})();
