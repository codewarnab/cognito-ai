/**
 * Extraction Queue Processor
 * Phase 5 of the auto-memory-extraction implementation
 *
 * Processes pending extractions from the queue.
 * Called by the alarm handler to run in the background.
 */

import { createLogger } from '~logger';
import { loadThreadMessages } from '~/db';
import { isSupermemoryReady } from '@/utils/supermemory';
import { isAutoExtractionEnabled, getAutoExtractionMinMessages } from '@/utils/supermemory/autoExtraction';
import { extractFactsFromMessages } from './extractionService';
import { addFactsBatch } from './addService';
import {
  getNextPendingExtraction,
  updateQueueItemStatus,
  cleanupCompletedItems,
  clearAlarmIfEmpty,
  saveThreadExtractionMeta,
  getThreadExtractionMeta,
} from './queue';

const log = createLogger('ExtractionProcessor', 'BACKGROUND');

const RE_EXTRACTION_THRESHOLD = 10; // New messages needed to re-extract

/**
 * Process pending extractions in the queue
 * Called by the alarm handler
 */
export async function processExtractionQueue(): Promise<void> {
  log.debug('Processing extraction queue');

  try {
    // Check if feature is enabled
    const [smReady, autoEnabled] = await Promise.all([
      isSupermemoryReady(),
      isAutoExtractionEnabled(),
    ]);

    if (!smReady || !autoEnabled) {
      log.debug('Extraction skipped - feature disabled or Supermemory not ready', {
        smReady,
        autoEnabled,
      });
      await clearAlarmIfEmpty();
      return;
    }

    // Get next pending item
    const item = await getNextPendingExtraction();
    if (!item) {
      log.debug('No pending extractions in queue');
      await clearAlarmIfEmpty();
      return;
    }

    log.info('Processing extraction', {
      threadId: item.threadId,
      queuedAt: item.queuedAt,
      retryCount: item.retryCount,
    });

    await processExtractionItem(item.threadId);
  } catch (error) {
    log.error('Extraction queue processing failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Always cleanup completed items
  await cleanupCompletedItems();
}


/**
 * Process a single extraction item
 *
 * @param threadId - The thread ID to process
 */
async function processExtractionItem(threadId: string): Promise<void> {
  try {
    // Mark as processing
    await updateQueueItemStatus(threadId, 'processing');

    // Get minimum messages setting
    const minMessages = await getAutoExtractionMinMessages();

    // Load messages from database
    const messages = await loadThreadMessages(threadId);

    if (messages.length < minMessages) {
      log.debug('Not enough messages for extraction', {
        threadId,
        count: messages.length,
        required: minMessages,
      });
      await updateQueueItemStatus(threadId, 'completed');
      return;
    }

    // Check if we should skip based on previous extraction
    const shouldExtract = await shouldExtractThread(threadId, messages.length);
    if (!shouldExtract) {
      log.debug('Skipping extraction - not enough new messages', { threadId });
      await updateQueueItemStatus(threadId, 'completed');
      return;
    }

    // Extract facts using AI
    const result = await extractFactsFromMessages(threadId, messages);

    if (result.facts.length === 0) {
      log.info('No facts extracted from thread', { threadId });
      await updateQueueItemStatus(threadId, 'completed');
      await saveThreadExtractionMeta(threadId, {
        lastExtractionAt: Date.now(),
        lastContentHash: result.contentHash,
        messageCountAtExtraction: messages.length,
        extractedFactsCount: 0,
      });
      return;
    }

    // Add facts to Supermemory
    const { succeeded, failed } = await addFactsBatch(result.facts, threadId);

    // Save extraction metadata
    await saveThreadExtractionMeta(threadId, {
      lastExtractionAt: Date.now(),
      lastContentHash: result.contentHash,
      messageCountAtExtraction: messages.length,
      extractedFactsCount: succeeded,
    });

    // Mark as complete
    await updateQueueItemStatus(threadId, 'completed');

    log.info('Extraction complete', {
      threadId,
      factsExtracted: result.facts.length,
      factsAdded: succeeded,
      factsFailed: failed,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    log.error('Extraction failed for thread', { threadId, error: errorMsg });
    await updateQueueItemStatus(threadId, 'failed', errorMsg);
  }
}

/**
 * Check if a thread should be extracted based on previous extraction
 *
 * @param threadId - The thread ID to check
 * @param currentMessageCount - Current number of messages in thread
 * @returns True if extraction should proceed
 */
async function shouldExtractThread(
  threadId: string,
  currentMessageCount: number
): Promise<boolean> {
  const meta = await getThreadExtractionMeta(threadId);

  // No previous extraction - should extract
  if (!meta) {
    return true;
  }

  // Check if enough new messages since last extraction
  const newMessages = currentMessageCount - meta.messageCountAtExtraction;
  if (newMessages >= RE_EXTRACTION_THRESHOLD) {
    log.debug('Re-extraction triggered', {
      threadId,
      newMessages,
      threshold: RE_EXTRACTION_THRESHOLD,
    });
    return true;
  }

  return false;
}

/**
 * Manually trigger extraction for a specific thread
 * Bypasses queue and processes immediately
 *
 * @param threadId - The thread ID to extract
 * @returns True if extraction was successful
 */
export async function triggerImmediateExtraction(threadId: string): Promise<boolean> {
  log.info('Triggering immediate extraction', { threadId });

  try {
    // Check if feature is enabled
    const [smReady, autoEnabled] = await Promise.all([
      isSupermemoryReady(),
      isAutoExtractionEnabled(),
    ]);

    if (!smReady || !autoEnabled) {
      log.warn('Cannot trigger extraction - feature disabled or Supermemory not ready');
      return false;
    }

    await processExtractionItem(threadId);
    return true;
  } catch (error) {
    log.error('Immediate extraction failed', {
      threadId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}
