/**
 * Extraction Trigger Utility
 * Phase 6 of the auto-memory-extraction implementation
 *
 * Checks if a thread should be queued for extraction and sends
 * a message to the background script to queue it.
 */

import { createLogger } from '~logger';
import { loadThreadMessages } from '~/db';
import { isSupermemoryReady } from '@/utils/supermemory/credentials';
import { isAutoExtractionEnabled, getAutoExtractionMinMessages } from './autoExtraction';

const log = createLogger('ExtractionTrigger', 'UTILS');

const META_STORAGE_KEY = 'supermemory:threadExtractionMeta';
const RE_EXTRACTION_THRESHOLD = 10; // New messages needed to re-extract

/**
 * Thread extraction metadata stored in chrome.storage.local
 */
interface ThreadExtractionMeta {
  lastExtractionAt: number;
  lastContentHash: string;
  messageCountAtExtraction: number;
  extractedFactsCount: number;
}

/**
 * Get thread extraction metadata from storage
 *
 * @param threadId - The thread ID to get metadata for
 * @returns The extraction metadata or null if not found
 */
async function getThreadExtractionMeta(
  threadId: string
): Promise<ThreadExtractionMeta | null> {
  try {
    const storage = await chrome.storage.local.get(META_STORAGE_KEY);
    const allMeta = (storage[META_STORAGE_KEY] || {}) as Record<string, ThreadExtractionMeta>;
    return allMeta[threadId] || null;
  } catch (error) {
    log.warn('Failed to get thread extraction meta', {
      threadId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Check if a thread should be queued for extraction and send message to background
 *
 * This function is called when the user navigates away from a thread (creates new
 * thread or switches to another thread). It checks eligibility criteria and sends
 * a message to the background script to queue the thread for extraction.
 *
 * @param threadId - The thread ID to potentially queue for extraction
 */
export async function maybeQueueForExtraction(threadId: string): Promise<void> {
  try {
    // Check if feature is enabled
    const [smReady, autoEnabled, minMessages] = await Promise.all([
      isSupermemoryReady(),
      isAutoExtractionEnabled(),
      getAutoExtractionMinMessages(),
    ]);

    if (!smReady || !autoEnabled) {
      log.debug('Auto-extraction skipped - feature disabled or Supermemory not ready', {
        threadId,
        smReady,
        autoEnabled,
      });
      return;
    }

    // Load messages to check count
    const messages = await loadThreadMessages(threadId);
    if (messages.length < minMessages) {
      log.debug('Not enough messages for extraction', {
        threadId,
        count: messages.length,
        required: minMessages,
      });
      return;
    }

    // Check if already extracted and if enough new messages since last extraction
    const meta = await getThreadExtractionMeta(threadId);
    if (meta) {
      const newMessages = messages.length - meta.messageCountAtExtraction;
      if (newMessages < RE_EXTRACTION_THRESHOLD) {
        log.debug('Not enough new messages for re-extraction', {
          threadId,
          newMessages,
          threshold: RE_EXTRACTION_THRESHOLD,
        });
        return;
      }
      log.debug('Thread eligible for re-extraction', {
        threadId,
        newMessages,
        threshold: RE_EXTRACTION_THRESHOLD,
      });
    }

    // Send to background for queueing
    await chrome.runtime.sendMessage({
      type: 'QUEUE_MEMORY_EXTRACTION',
      threadId,
      messageCount: messages.length,
    });

    log.info('Thread queued for extraction', { threadId, messageCount: messages.length });
  } catch (error) {
    // Fire-and-forget pattern - don't throw, just log
    log.warn('Failed to check extraction eligibility', {
      threadId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
