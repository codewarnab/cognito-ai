/**
 * Supermemory Add Service
 * Phase 4 of the auto-memory-extraction implementation
 *
 * Handles adding extracted facts to Supermemory via their API.
 * Includes rate limiting to avoid API throttling.
 */

import { createLogger } from '~logger';
import { getSupermemoryApiKey, getSupermemoryUserId } from '@/utils/supermemory';
import type { ExtractedFact } from './types';

const log = createLogger('MemoryAddService', 'BACKGROUND');

const SUPERMEMORY_ADD_URL = 'https://api.supermemory.ai/v3/documents';
const BATCH_DELAY_MS = 200; // Delay between API calls to avoid rate limiting

/**
 * Result from adding a memory to Supermemory
 */
export interface AddMemoryResult {
  id: string;
  status: 'queued' | 'processing' | 'done';
}

/**
 * Result from batch adding facts
 */
export interface BatchAddResult {
  succeeded: number;
  failed: number;
  results: Array<{
    fact: ExtractedFact;
    success: boolean;
    id?: string;
    error?: string;
  }>;
}

/**
 * Add a single fact to Supermemory
 *
 * @param fact - The extracted fact to add
 * @param apiKey - Supermemory API key
 * @param userId - User's Supermemory container ID
 * @param threadId - Source thread ID for metadata
 * @returns Promise<AddMemoryResult> - The API response
 */
export async function addFactToSupermemory(
  fact: ExtractedFact,
  apiKey: string,
  userId: string,
  threadId: string
): Promise<AddMemoryResult> {
  const response = await fetch(SUPERMEMORY_ADD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: fact.content,
      containerTag: userId,
      metadata: {
        source: 'cognito-auto-extraction',
        category: fact.category,
        confidence: fact.confidence,
        threadId: threadId,
        extractedAt: Date.now(),
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supermemory API error: ${response.status} - ${errorText}`);
  }

  return (await response.json()) as AddMemoryResult;
}

/**
 * Add multiple facts to Supermemory with rate limiting
 *
 * Processes facts sequentially with a delay between each to avoid
 * hitting rate limits. Continues processing even if individual facts fail.
 *
 * @param facts - Array of extracted facts to add
 * @param threadId - Source thread ID for metadata
 * @returns Promise<BatchAddResult> - Summary of succeeded/failed additions
 */
export async function addFactsBatch(
  facts: ExtractedFact[],
  threadId: string
): Promise<BatchAddResult> {
  const apiKey = await getSupermemoryApiKey();
  const userId = await getSupermemoryUserId();

  if (!apiKey) {
    throw new Error('Supermemory API key not configured');
  }

  if (!userId) {
    throw new Error('Supermemory user ID not available');
  }

  const results: BatchAddResult['results'] = [];
  let succeeded = 0;
  let failed = 0;

  log.info('Starting batch add to Supermemory', {
    factCount: facts.length,
    threadId,
  });

  for (let i = 0; i < facts.length; i++) {
    const fact = facts[i];

    try {
      const result = await addFactToSupermemory(fact, apiKey, userId, threadId);
      succeeded++;
      results.push({
        fact,
        success: true,
        id: result.id,
      });
      log.debug('Fact added to Supermemory', {
        category: fact.category,
        confidence: fact.confidence,
        id: result.id,
      });
    } catch (error) {
      failed++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.push({
        fact,
        success: false,
        error: errorMessage,
      });
      log.warn('Failed to add fact to Supermemory', {
        category: fact.category,
        error: errorMessage,
      });
    }

    // Rate limiting delay between calls (skip after last item)
    if (i < facts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  log.info('Batch add complete', {
    succeeded,
    failed,
    total: facts.length,
    threadId,
  });

  return { succeeded, failed, results };
}

/**
 * Validate that Supermemory is configured for adding memories
 *
 * @returns Promise<boolean> - True if API key and user ID are available
 */
export async function canAddToSupermemory(): Promise<boolean> {
  try {
    const [apiKey, userId] = await Promise.all([
      getSupermemoryApiKey(),
      getSupermemoryUserId(),
    ]);
    return !!apiKey && !!userId;
  } catch (error) {
    log.warn('Failed to check Supermemory configuration', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return false;
  }
}
