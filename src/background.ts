/**
 * MV3 Background Service Worker - Main Entry Point
 * 
 * Orchestrates:
 * - Model readiness checks
 * - Privacy controls (data wipe)
 * - Message routing
 */

// Model system
import { initializeModelSystem, handleModelRetryAlarm } from './background/model-ready';

// Privacy controls
import { executeWipe, getWipeAlarmName } from './background/privacy';

// Message handling
import { handleMessage } from './background/message-handler';

// ============================================================================
// Runtime Listeners
// ============================================================================

/**
 * Extension install/update handler
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('[Background] onInstalled:', details.reason);

    try {
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
        await initializeModelSystem('startup');
    } catch (error) {
        console.error('[Background] onStartup error:', error);
    }
});

/**
 * Alarm handler
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
    const wipeAlarmName = getWipeAlarmName();

    if (alarm.name === 'model-retry') {
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

// ============================================================================
// Initialization
// ============================================================================

console.log('[Background] Service worker loaded');

// Initialize on load (for existing installs)
(async () => {
    try {
        await initializeModelSystem('load');
    } catch (error) {
        console.error('[Background] Initialization error:', error);
    }
})();
