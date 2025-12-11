/**
 * Content Memory Processor
 * Processes queued content interactions to extract and save insights
 */

import { createLogger } from '~logger';
import {
  getGoogleApiKey,
  getVertexCredentials,
  hasGoogleApiKey,
  hasVertexCredentials,
} from '@/utils/credentials';
import { GEMINI_MODELS } from '~/constants';
import { generateVertexAccessToken } from '../../summarizer/vertexAuth';
import { isSupermemoryReady } from '@/utils/supermemory';
import {
  isContentMemoryEnabled,
  getEnabledContentMemorySources,
} from '@/utils/supermemory/autoExtraction';
import { addFactsBatch } from '../extraction/addService';
import {
  getNextPendingItem,
  updateItemStatus,
  cleanupQueue,
  hasQueuedItems,
} from './queue';
import { getContentInsightFunction, parseContentInsights } from './functionDeclarations';
import { getPromptBuilder } from './prompts';
import type { ContentMemoryItem, ContentInsight } from './types';

const log = createLogger('ContentMemoryProcessor', 'BACKGROUND');

/**
 * Provider configuration
 */
interface ProviderInfo {
  type: 'google' | 'vertex';
  url: string;
  headers: Record<string, string>;
}

/**
 * Get provider info for API calls
 * Priority: Google AI (API key) > Vertex AI (service account)
 */
async function getProviderInfo(): Promise<ProviderInfo> {
  const model = GEMINI_MODELS.FLASH;
  const googleBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  const vertexBaseUrlTemplate = 'https://{location}-aiplatform.googleapis.com/v1';

  // Check Google AI first (preferred)
  if (await hasGoogleApiKey()) {
    const apiKey = await getGoogleApiKey();
    log.debug('Using Google AI provider for content memory');
    return {
      type: 'google',
      url: `${googleBaseUrl}/models/${model}:generateContent?key=${apiKey}`,
      headers: { 'Content-Type': 'application/json' },
    };
  }

  // Fall back to Vertex AI
  if (await hasVertexCredentials()) {
    const credentials = await getVertexCredentials();
    if (!credentials) {
      throw new Error('Vertex credentials not found');
    }

    const accessToken = await generateVertexAccessToken(credentials);
    const vertexBaseUrl = vertexBaseUrlTemplate.replace('{location}', credentials.location);

    log.debug('Using Vertex AI provider for content memory', { location: credentials.location });
    return {
      type: 'vertex',
      url: `${vertexBaseUrl}/projects/${credentials.projectId}/locations/${credentials.location}/publishers/google/models/${model}:generateContent`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    };
  }

  throw new Error('No AI provider configured');
}

/**
 * Extract insights from a content memory item
 */
async function extractInsights(item: ContentMemoryItem): Promise<ContentInsight[]> {
  const provider = await getProviderInfo();
  const { system, build } = getPromptBuilder(item.source);
  const prompt = build(item);
  const tool = getContentInsightFunction(item.source);
  const functionDeclaration = tool.functionDeclarations?.[0];
  if (!functionDeclaration) {
    throw new Error('No function declaration found for content insight extraction');
  }
  const functionName = functionDeclaration.name;

  const requestBody = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [tool],
    toolConfig: {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: [functionName],
      },
    },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  };

  log.debug('Making content memory extraction API call', {
    provider: provider.type,
    source: item.source,
    itemId: item.id,
  });

  const response = await fetch(provider.url, {
    method: 'POST',
    headers: provider.headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const functionCallPart = parts.find((p: Record<string, unknown>) => p.functionCall);

  if (!functionCallPart?.functionCall) {
    log.debug('No function call in response', { itemId: item.id });
    return [];
  }

  const functionCall = functionCallPart.functionCall as { name: string; args: unknown };
  const insights = parseContentInsights(functionCall.args, item.source);

  return insights || [];
}

/**
 * Process pending content memory items
 * Called by alarm handler
 */
export async function processContentMemoryQueue(): Promise<void> {
  // Check if feature is enabled
  const [smReady, contentMemoryEnabled, enabledSources] = await Promise.all([
    isSupermemoryReady(),
    isContentMemoryEnabled(),
    getEnabledContentMemorySources(),
  ]);

  if (!smReady || !contentMemoryEnabled) {
    log.debug('Content memory processing skipped - disabled');
    await clearAlarmIfEmpty();
    return;
  }

  // Get next pending item
  const item = await getNextPendingItem();
  if (!item) {
    log.debug('No pending content memory items');
    await clearAlarmIfEmpty();
    return;
  }

  // Check if this source is enabled
  if (!enabledSources.includes(item.source)) {
    log.debug('Source not enabled, marking completed', { source: item.source });
    await updateItemStatus(item.id, 'completed');
    return;
  }

  log.info('Processing content memory item', {
    id: item.id,
    source: item.source,
  });

  try {
    await updateItemStatus(item.id, 'processing');

    // Extract insights
    const insights = await extractInsights(item);

    if (insights.length === 0) {
      log.info('No insights extracted', { itemId: item.id });
      await updateItemStatus(item.id, 'completed');
      return;
    }

    // Convert insights to facts for Supermemory
    // Map content memory categories to ExtractedFact categories
    const categoryMap: Record<string, 'preference' | 'fact' | 'interest' | 'instruction' | 'context'> = {
      interest: 'interest',
      writing_style: 'preference',
      topic: 'interest',
      preference: 'preference',
      context: 'context',
    };

    const facts = insights.map((insight) => ({
      content: insight.content,
      confidence: insight.confidence,
      category: categoryMap[insight.category] || 'fact',
    }));

    // Add to Supermemory
    const { succeeded, failed } = await addFactsBatch(facts, `content-${item.source}-${item.id}`);

    await updateItemStatus(item.id, 'completed');
    log.info('Content memory processing complete', {
      itemId: item.id,
      source: item.source,
      insightsAdded: succeeded,
      insightsFailed: failed,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    log.error('Content memory processing failed', { itemId: item.id, error: errorMsg });
    await updateItemStatus(item.id, 'failed', errorMsg);
  }

  // Cleanup old items
  await cleanupQueue();
}

/**
 * Clear the alarm if queue is empty
 */
async function clearAlarmIfEmpty(): Promise<void> {
  try {
    const hasItems = await hasQueuedItems();
    if (!hasItems) {
      await chrome.alarms.clear('content-memory-processing');
      log.debug('Cleared content memory alarm - queue empty');
    }
  } catch (error) {
    log.error('Failed to clear content memory alarm', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}
