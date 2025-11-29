/**
 * Content Memory Queue Manager
 * Manages the queue of content interactions to process for memory building
 */

import { createLogger } from '~logger';
import type { ContentMemoryItem } from './types';

const log = createLogger('ContentMemoryQueue', 'BACKGROUND');

const QUEUE_STORAGE_KEY = 'supermemory:contentMemoryQueue';
const MAX_QUEUE_SIZE = 50;
const MAX_RETRIES = 3;

/**
 * Add an item to the content memory queue
 */
export async function queueContentMemoryItem(
  item: Omit<ContentMemoryItem, 'id' | 'queuedAt' | 'status' | 'retryCount'>
): Promise<void> {
  try {
    const queue = await getQueue();

    // Trim queue if too large (remove oldest completed/failed items first)
    if (queue.length >= MAX_QUEUE_SIZE) {
      const trimmedQueue = queue
        .filter((q) => q.status === 'pending' || q.status === 'processing')
        .slice(-MAX_QUEUE_SIZE + 1);
      await saveQueue(trimmedQueue);
      log.debug('Trimmed content memory queue', {
        originalSize: queue.length,
        newSize: trimmedQueue.length,
      });
    }

    const fullItem: ContentMemoryItem = {
      ...item,
      id: crypto.randomUUID(),
      queuedAt: Date.now(),
      status: 'pending',
      retryCount: 0,
    } as ContentMemoryItem;

    queue.push(fullItem);
    await saveQueue(queue);

    log.info('Content memory item queued', {
      id: fullItem.id,
      source: fullItem.source,
    });

    // Ensure processing alarm is set
    await ensureContentMemoryAlarm();
  } catch (error) {
    log.error('Failed to queue content memory item', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get next pending item from queue
 */
export async function getNextPendingItem(): Promise<ContentMemoryItem | null> {
  try {
    const queue = await getQueue();
    return queue.find((q) => q.status === 'pending') || null;
  } catch (error) {
    log.error('Failed to get next pending item', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Update item status in queue
 */
export async function updateItemStatus(
  itemId: string,
  status: ContentMemoryItem['status'],
  error?: string
): Promise<void> {
  try {
    const queue = await getQueue();
    const item = queue.find((q) => q.id === itemId);

    if (item) {
      item.status = status;
      if (error) item.lastError = error;
      if (status === 'failed') item.retryCount++;
      await saveQueue(queue);
      log.debug('Updated item status', { itemId, status });
    }
  } catch (err) {
    log.error('Failed to update item status', {
      itemId,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

/**
 * Remove completed and max-retried items
 */
export async function cleanupQueue(): Promise<void> {
  try {
    const queue = await getQueue();
    const cleaned = queue.filter(
      (q) =>
        q.status !== 'completed' &&
        !(q.status === 'failed' && q.retryCount >= MAX_RETRIES)
    );

    if (cleaned.length !== queue.length) {
      await saveQueue(cleaned);
      log.debug('Cleaned content memory queue', {
        removed: queue.length - cleaned.length,
      });
    }
  } catch (error) {
    log.error('Failed to cleanup queue', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Check if queue has pending items
 */
export async function hasQueuedItems(): Promise<boolean> {
  try {
    const queue = await getQueue();
    return queue.some((q) => q.status === 'pending');
  } catch {
    return false;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  try {
    const queue = await getQueue();
    return {
      total: queue.length,
      pending: queue.filter((q) => q.status === 'pending').length,
      processing: queue.filter((q) => q.status === 'processing').length,
      completed: queue.filter((q) => q.status === 'completed').length,
      failed: queue.filter((q) => q.status === 'failed').length,
    };
  } catch {
    return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
  }
}

/**
 * Reset a failed item to pending for retry
 */
export async function retryFailedItem(itemId: string): Promise<boolean> {
  try {
    const queue = await getQueue();
    const item = queue.find((q) => q.id === itemId);

    if (item && item.status === 'failed' && item.retryCount < MAX_RETRIES) {
      item.status = 'pending';
      await saveQueue(queue);
      await ensureContentMemoryAlarm();
      log.info('Reset failed item for retry', { itemId, retryCount: item.retryCount });
      return true;
    }
    return false;
  } catch (error) {
    log.error('Failed to retry item', {
      itemId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

// Internal helpers
async function getQueue(): Promise<ContentMemoryItem[]> {
  const storage = await chrome.storage.local.get(QUEUE_STORAGE_KEY);
  return storage[QUEUE_STORAGE_KEY] || [];
}

async function saveQueue(queue: ContentMemoryItem[]): Promise<void> {
  await chrome.storage.local.set({ [QUEUE_STORAGE_KEY]: queue });
}

async function ensureContentMemoryAlarm(): Promise<void> {
  try {
    const alarm = await chrome.alarms.get('content-memory-processing');
    if (!alarm) {
      chrome.alarms.create('content-memory-processing', {
        delayInMinutes: 2,
        periodInMinutes: 10,
      });
      log.debug('Created content memory processing alarm');
    }
  } catch (error) {
    log.error('Failed to create content memory alarm', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
