/**
 * Extraction Queue Manager
 * Phase 5 of the auto-memory-extraction implementation
 *
 * Manages the queue of threads pending extraction and their metadata.
 * Uses chrome.storage.local for persistence across browser restarts.
 */

import { createLogger } from '~logger';
import type { QueuedExtraction, ThreadExtractionMeta } from './types';

const log = createLogger('ExtractionQueue', 'BACKGROUND');

const QUEUE_STORAGE_KEY = 'supermemory:extractionQueue';
const META_STORAGE_KEY = 'supermemory:threadExtractionMeta';
const MAX_RETRIES = 3;
const ALARM_NAME = 'memory-extraction';

/**
 * Add a thread to the extraction queue
 *
 * @param threadId - The thread ID to queue
 * @param messageCount - Current message count in the thread
 */
export async function queueThreadForExtraction(
  threadId: string,
  messageCount: number
): Promise<void> {
  try {
    const queue = await getQueue();

    // Check if already queued and pending
    const existing = queue.find(q => q.threadId === threadId);
    if (existing && existing.status === 'pending') {
      log.debug('Thread already queued', { threadId });
      return;
    }

    // Remove any existing entry for this thread
    const filtered = queue.filter(q => q.threadId !== threadId);

    const item: QueuedExtraction = {
      threadId,
      queuedAt: Date.now(),
      messageCount,
      retryCount: 0,
      status: 'pending',
    };

    filtered.push(item);
    await saveQueue(filtered);

    log.info('Thread queued for extraction', { threadId, messageCount });

    // Ensure alarm is set to process the queue
    await ensureExtractionAlarm();
  } catch (error) {
    log.error('Failed to queue thread for extraction', {
      threadId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}


/**
 * Get next pending item from queue
 *
 * @returns The next pending extraction or null if queue is empty
 */
export async function getNextPendingExtraction(): Promise<QueuedExtraction | null> {
  try {
    const queue = await getQueue();
    return queue.find(q => q.status === 'pending') || null;
  } catch (error) {
    log.error('Failed to get next pending extraction', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Update queue item status
 *
 * @param threadId - The thread ID to update
 * @param status - New status
 * @param error - Optional error message for failed status
 */
export async function updateQueueItemStatus(
  threadId: string,
  status: QueuedExtraction['status'],
  error?: string
): Promise<void> {
  try {
    const queue = await getQueue();
    const item = queue.find(q => q.threadId === threadId);

    if (item) {
      item.status = status;
      if (error) {
        item.lastError = error;
      }
      if (status === 'failed') {
        item.retryCount++;
      }
      await saveQueue(queue);
      log.debug('Queue item status updated', { threadId, status, retryCount: item.retryCount });
    }
  } catch (err) {
    log.error('Failed to update queue item status', {
      threadId,
      status,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

/**
 * Remove completed and max-retried items from queue
 */
export async function cleanupCompletedItems(): Promise<void> {
  try {
    const queue = await getQueue();
    const filtered = queue.filter(
      q =>
        q.status !== 'completed' &&
        !(q.status === 'failed' && q.retryCount >= MAX_RETRIES)
    );

    if (filtered.length !== queue.length) {
      await saveQueue(filtered);
      log.debug('Cleaned up queue items', {
        removed: queue.length - filtered.length,
        remaining: filtered.length,
      });
    }
  } catch (error) {
    log.error('Failed to cleanup completed items', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Check if queue has pending items
 *
 * @returns True if there are pending extractions
 */
export async function hasQueuedItems(): Promise<boolean> {
  try {
    const queue = await getQueue();
    return queue.some(q => q.status === 'pending');
  } catch (error) {
    log.error('Failed to check queued items', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Reset failed items to pending for retry
 * Only resets items that haven't exceeded max retries
 */
export async function resetFailedItems(): Promise<number> {
  try {
    const queue = await getQueue();
    let resetCount = 0;

    for (const item of queue) {
      if (item.status === 'failed' && item.retryCount < MAX_RETRIES) {
        item.status = 'pending';
        resetCount++;
      }
    }

    if (resetCount > 0) {
      await saveQueue(queue);
      log.info('Reset failed items for retry', { count: resetCount });
    }

    return resetCount;
  } catch (error) {
    log.error('Failed to reset failed items', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}


/**
 * Get thread extraction metadata
 *
 * @param threadId - The thread ID to get metadata for
 * @returns The extraction metadata or null if not found
 */
export async function getThreadExtractionMeta(
  threadId: string
): Promise<ThreadExtractionMeta | null> {
  try {
    const storage = await chrome.storage.local.get(META_STORAGE_KEY);
    const allMeta = (storage[META_STORAGE_KEY] || {}) as Record<string, ThreadExtractionMeta>;
    return allMeta[threadId] || null;
  } catch (error) {
    log.error('Failed to get thread extraction meta', {
      threadId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Save thread extraction metadata
 *
 * @param threadId - The thread ID to save metadata for
 * @param meta - The extraction metadata to save
 */
export async function saveThreadExtractionMeta(
  threadId: string,
  meta: ThreadExtractionMeta
): Promise<void> {
  try {
    const storage = await chrome.storage.local.get(META_STORAGE_KEY);
    const allMeta = (storage[META_STORAGE_KEY] || {}) as Record<string, ThreadExtractionMeta>;
    allMeta[threadId] = meta;
    await chrome.storage.local.set({ [META_STORAGE_KEY]: allMeta });
    log.debug('Saved thread extraction meta', { threadId, factsCount: meta.extractedFactsCount });
  } catch (error) {
    log.error('Failed to save thread extraction meta', {
      threadId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Clear extraction metadata for a thread
 *
 * @param threadId - The thread ID to clear metadata for
 */
export async function clearThreadExtractionMeta(threadId: string): Promise<void> {
  try {
    const storage = await chrome.storage.local.get(META_STORAGE_KEY);
    const allMeta = (storage[META_STORAGE_KEY] || {}) as Record<string, ThreadExtractionMeta>;
    delete allMeta[threadId];
    await chrome.storage.local.set({ [META_STORAGE_KEY]: allMeta });
    log.debug('Cleared thread extraction meta', { threadId });
  } catch (error) {
    log.error('Failed to clear thread extraction meta', {
      threadId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Get the current extraction queue from storage
 */
async function getQueue(): Promise<QueuedExtraction[]> {
  const storage = await chrome.storage.local.get(QUEUE_STORAGE_KEY);
  return (storage[QUEUE_STORAGE_KEY] || []) as QueuedExtraction[];
}

/**
 * Save the extraction queue to storage
 */
async function saveQueue(queue: QueuedExtraction[]): Promise<void> {
  await chrome.storage.local.set({ [QUEUE_STORAGE_KEY]: queue });
}

/**
 * Ensure the extraction alarm is set
 * Creates alarm if it doesn't exist
 */
async function ensureExtractionAlarm(): Promise<void> {
  try {
    const alarm = await chrome.alarms.get(ALARM_NAME);
    if (!alarm) {
      chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: 1,
        periodInMinutes: 5,
      });
      log.debug('Created extraction alarm');
    }
  } catch (error) {
    log.error('Failed to ensure extraction alarm', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Clear the extraction alarm if no pending items
 */
export async function clearAlarmIfEmpty(): Promise<void> {
  try {
    const hasPending = await hasQueuedItems();
    if (!hasPending) {
      await chrome.alarms.clear(ALARM_NAME);
      log.debug('Cleared extraction alarm - queue empty');
    }
  } catch (error) {
    log.error('Failed to clear extraction alarm', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
