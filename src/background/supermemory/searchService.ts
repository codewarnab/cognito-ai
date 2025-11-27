/**
 * Supermemory Search Service
 * Direct REST API integration for searching user memories
 * Used by Writer and Rewriter features
 */

import { createLogger } from '~logger';
import { getSupermemoryApiKey, isSupermemoryReady, getSupermemoryUserId } from '@/utils/supermemory';

const log = createLogger('SupermemorySearch', 'BACKGROUND');

const SUPERMEMORY_SEARCH_URL = 'https://api.supermemory.ai/v4/search';

export interface MemorySearchResult {
    id: string;
    memory: string;
    similarity: number;
    metadata?: Record<string, unknown>;
}

export interface SearchMemoriesOptions {
    query: string;
    limit?: number;           // Default: 5
    threshold?: number;       // Default: 0.5
    rerank?: boolean;         // Default: true
    includeFullDocs?: boolean;
}

export interface SearchMemoriesResponse {
    success: boolean;
    results: MemorySearchResult[];
    timing?: number;
    total?: number;
    error?: string;
}

/**
 * Search Supermemory for relevant memories
 */
export async function searchMemories(
    options: SearchMemoriesOptions
): Promise<SearchMemoriesResponse> {
    // Validate Supermemory is ready
    const ready = await isSupermemoryReady();
    if (!ready) {
        return {
            success: false,
            results: [],
            error: 'Supermemory not configured. Please add your API key in settings.',
        };
    }

    const apiKey = await getSupermemoryApiKey();
    if (!apiKey) {
        return {
            success: false,
            results: [],
            error: 'Supermemory API key not found.',
        };
    }

    const userId = await getSupermemoryUserId();

    const { query, limit = 5, threshold = 0.5, rerank = true } = options;

    log.debug('Searching memories', { queryLength: query.length, limit, threshold });

    try {
        const response = await fetch(SUPERMEMORY_SEARCH_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: query,
                limit,
                threshold,
                rerank,
                containerTag: userId,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('Supermemory API error', { status: response.status, error: errorText });

            // Handle specific error cases
            if (response.status === 401 || response.status === 403) {
                return {
                    success: false,
                    results: [],
                    error: 'Invalid Supermemory API key. Please check your credentials.',
                };
            }

            if (response.status === 429) {
                return {
                    success: false,
                    results: [],
                    error: 'Memory search rate limited. Please wait a moment.',
                };
            }

            return {
                success: false,
                results: [],
                error: `Supermemory error: ${response.status}`,
            };
        }

        const data = await response.json();

        // Extract relevant fields from results
        const results: MemorySearchResult[] = (data.results || []).map((r: Record<string, unknown>) => ({
            id: r.id as string,
            memory: r.memory as string,
            similarity: r.similarity as number,
            metadata: r.metadata as Record<string, unknown> | undefined,
        }));

        log.info('Memory search complete', {
            resultCount: results.length,
            timing: data.timing,
            total: data.total
        });

        return {
            success: true,
            results,
            timing: data.timing,
            total: data.total,
        };
    } catch (error) {
        log.error('Memory search failed', { error: error instanceof Error ? error.message : 'Unknown' });
        return {
            success: false,
            results: [],
            error: error instanceof Error ? error.message : 'Failed to search memories',
        };
    }
}

/**
 * Format memory results for inclusion in AI prompts
 */
export function formatMemoriesForPrompt(results: MemorySearchResult[]): string {
    if (results.length === 0) return '';

    const formattedMemories = results
        .map((r, i) => `[Memory ${i + 1}] (relevance: ${(r.similarity * 100).toFixed(0)}%)\n${r.memory}`)
        .join('\n\n');

    return `\n\n--- Relevant User Memories ---\n${formattedMemories}\n--- End Memories ---\n`;
}

/**
 * Check if Supermemory search is available (API key configured and enabled)
 * Wrapper for isSupermemoryReady for consistency in naming
 */
export async function isMemorySearchAvailable(): Promise<boolean> {
    return isSupermemoryReady();
}
