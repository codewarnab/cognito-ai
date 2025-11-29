/**
 * Hook functions for content memory building
 * Called from handlers after successful operations
 */

import { createLogger } from '~logger';
import {
  isSupermemoryReady,
  isContentMemoryEnabled,
  getEnabledContentMemorySources,
} from '@/utils/supermemory';
import { queueContentMemoryItem } from './queue';
import type {
  SummarizerMemoryItem,
  WriterMemoryItem,
  RewriterMemoryItem,
} from './types';

const log = createLogger('ContentMemoryHooks', 'BACKGROUND');

// Minimum text lengths to consider for memory building
const MIN_TEXT_LENGTH = 100;
const MIN_SUMMARY_LENGTH = 50;
const MIN_PROMPT_LENGTH = 10;

/**
 * Queue summarizer interaction for memory building
 */
export async function queueContentMemoryForSummarizer(data: {
  originalText: string;
  summary: string;
  summaryType: string;
  pageContext: { title: string; url: string; domain: string };
}): Promise<void> {
  try {
    // Quick checks before async operations
    if (data.originalText.length < MIN_TEXT_LENGTH || data.summary.length < MIN_SUMMARY_LENGTH) {
      log.debug('Summarizer content too short for memory', {
        textLength: data.originalText.length,
        summaryLength: data.summary.length,
      });
      return;
    }

    // Check if feature is enabled
    const [smReady, enabled, sources] = await Promise.all([
      isSupermemoryReady(),
      isContentMemoryEnabled(),
      getEnabledContentMemorySources(),
    ]);

    if (!smReady || !enabled || !sources.includes('summarizer')) {
      return;
    }

    await queueContentMemoryItem({
      source: 'summarizer',
      data,
    } as Omit<SummarizerMemoryItem, 'id' | 'queuedAt' | 'status' | 'retryCount'>);

    log.debug('Queued summarizer content for memory');
  } catch (error) {
    // Fire and forget - don't let errors affect the main flow
    log.warn('Failed to queue summarizer content for memory', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Queue writer interaction for memory building
 */
export async function queueContentMemoryForWriter(data: {
  prompt: string;
  generatedText: string;
  tone?: string;
  pageContext?: {
    title: string;
    url: string;
    domain: string;
    platform?: string;
    fieldType?: string;
  };
  hasAttachment: boolean;
}): Promise<void> {
  try {
    // Quick checks
    if (data.prompt.length < MIN_PROMPT_LENGTH || data.generatedText.length < MIN_TEXT_LENGTH) {
      log.debug('Writer content too short for memory', {
        promptLength: data.prompt.length,
        textLength: data.generatedText.length,
      });
      return;
    }

    const [smReady, enabled, sources] = await Promise.all([
      isSupermemoryReady(),
      isContentMemoryEnabled(),
      getEnabledContentMemorySources(),
    ]);

    if (!smReady || !enabled || !sources.includes('writer')) {
      return;
    }

    await queueContentMemoryItem({
      source: 'writer',
      data,
    } as Omit<WriterMemoryItem, 'id' | 'queuedAt' | 'status' | 'retryCount'>);

    log.debug('Queued writer content for memory');
  } catch (error) {
    // Fire and forget - don't let errors affect the main flow
    log.warn('Failed to queue writer content for memory', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Queue rewriter interaction for memory building
 */
export async function queueContentMemoryForRewriter(data: {
  originalText: string;
  rewrittenText: string;
  preset?: string;
  customInstruction?: string;
  pageContext?: { title: string; url: string; domain: string };
}): Promise<void> {
  try {
    // Quick checks
    if (data.originalText.length < MIN_TEXT_LENGTH) {
      log.debug('Rewriter content too short for memory', {
        textLength: data.originalText.length,
      });
      return;
    }

    const [smReady, enabled, sources] = await Promise.all([
      isSupermemoryReady(),
      isContentMemoryEnabled(),
      getEnabledContentMemorySources(),
    ]);

    if (!smReady || !enabled || !sources.includes('rewriter')) {
      return;
    }

    await queueContentMemoryItem({
      source: 'rewriter',
      data,
    } as Omit<RewriterMemoryItem, 'id' | 'queuedAt' | 'status' | 'retryCount'>);

    log.debug('Queued rewriter content for memory');
  } catch (error) {
    // Fire and forget - don't let errors affect the main flow
    log.warn('Failed to queue rewriter content for memory', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
