/**
 * Privacy controls - data wipe functionality
 */

import { wipeAllData } from '../db/index';
import { closeOffscreenIfIdle } from './offscreen-lifecycle';

const WIPE_ALARM_NAME = 'privacy:wipe';

let pendingWipeAlarm: string | null = null;
let isWiping = false;

/**
 * Schedule a data wipe
 */
export async function scheduleWipe(alsoRemoveModel: boolean = false, delayMs: number = 0): Promise<void> {
    console.log(`[Privacy] Scheduling wipe in ${delayMs}ms...`);

    if (delayMs > 0) {
        // Schedule alarm for delayed wipe
        await chrome.alarms.create(WIPE_ALARM_NAME, {
            when: Date.now() + delayMs
        });
        pendingWipeAlarm = WIPE_ALARM_NAME;

        // Store wipe settings
        await chrome.storage.local.set({
            pendingWipe: true,
            wipeRemoveModel: alsoRemoveModel
        });
    } else {
        // Execute immediately
        await executeWipe(alsoRemoveModel);
    }
}

/**
 * Cancel a pending wipe
 */
export async function cancelWipe(): Promise<void> {
    if (pendingWipeAlarm) {
        await chrome.alarms.clear(WIPE_ALARM_NAME);
        pendingWipeAlarm = null;
        await chrome.storage.local.remove(['pendingWipe', 'wipeRemoveModel']);
        console.log('[Privacy] Wipe cancelled');
    }
}

/**
 * Execute data wipe
 */
export async function executeWipe(alsoRemoveModel: boolean): Promise<void> {
    if (isWiping) {
        console.log('[Privacy] Wipe already in progress');
        return;
    }

    console.log('[Privacy] Executing data wipe...');
    isWiping = true;

    try {
        // Close offscreen document
        await closeOffscreenIfIdle();

        // Wipe all data
        await wipeAllData(alsoRemoveModel);

        // Clear pending wipe state
        await chrome.storage.local.remove(['pendingWipe', 'wipeRemoveModel']);
        pendingWipeAlarm = null;

        // Broadcast completion
        chrome.runtime.sendMessage({ type: 'privacy:wipe:done' }).catch(() => {
            // Ignore errors if no listeners
        });

        console.log('[Privacy] Data wipe completed');
    } catch (error) {
        console.error('[Privacy] Wipe failed:', error);
        throw error;
    } finally {
        isWiping = false;
    }
}

/**
 * Get wipe alarm name
 */
export function getWipeAlarmName(): string {
    return WIPE_ALARM_NAME;
}

/**
 * Check if wipe is in progress
 */
export function isWipeInProgress(): boolean {
    return isWiping;
}

/**
 * Get pending wipe alarm
 */
export function getPendingWipeAlarm(): string | null {
    return pendingWipeAlarm;
}
