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
        await ensureAlarms();
        await initializeModelSystem(details.reason);
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
        await openDb();
        await ensureAlarms();
    } catch (error) {
        console.error('[Background] Initialization error:', error);
    }
})();
