/**
 * Content Memory Startup Recovery
 * Handles recovery of stuck items after browser restart
 *
 * When the browser closes while items are being processed, those items
 * would be stuck in "processing" status. This module resets them to
 * "pending" so they can be retried.
 */

import { createLogger } from '~logger';
import type { ContentMemoryItem } from './types';

const log = createLogger('ContentMemoryStartup', 'BACKGROUND');

const QUEUE_STORAGE_KEY = 'supermemory:contentMemoryQueue';
const ALARM_NAME = 'content-memory-processing';

/**
 * Recover stuck items after browser restart
 * Called during service worker initialization
 *
 * This handles the case where the browser was closed while items were being processed.
 * Those items would be stuck in "processing" status and need to be reset to "pending".
 */
export async function recoverContentMemoryQueue(): Promise<void> {
  try {
    const storage = await chrome.storage.local.get(QUEUE_STORAGE_KEY);
    const queue = (storage[QUEUE_STORAGE_KEY] || []) as ContentMemoryItem[];

    if (queue.length === 0) {
      log.debug('No content memory items to recover');
      return;
    }

    let recoveredCount = 0;
    let pendingCount = 0;

    const recoveredQueue = queue.map(item => {
      if (item.status === 'processing') {
        recoveredCount++;
        return { ...item, status: 'pending' as const };
      }
      if (item.status === 'pending') {
        pendingCount++;
      }
      return item;
    });

    if (recoveredCount > 0) {
      await chrome.storage.local.set({ [QUEUE_STORAGE_KEY]: recoveredQueue });
      log.info('Recovered stuck content memory items', {
        recovered: recoveredCount,
        totalPending: pendingCount + recoveredCount,
      });
    }

    // Recreate alarm if there are pending items
    if (pendingCount + recoveredCount > 0) {
      const existingAlarm = await chrome.alarms.get(ALARM_NAME);
      if (!existingAlarm) {
        chrome.alarms.create(ALARM_NAME, {
          delayInMinutes: 1, // Start sooner after restart
          periodInMinutes: 10,
        });
        log.info('Recreated content memory processing alarm after startup');
      }
    }
  } catch (error) {
    log.error('Failed to recover content memory queue', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
