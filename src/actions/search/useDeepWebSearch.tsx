/**
 * Deep Web Search Tool
 * Executes multiple parallel searches with different query variations
 * for more comprehensive, in-depth results
 */

import { useEffect } from 'react';
import { z } from 'zod';
import { registerTool } from '@/ai/tools';
import { useToolUI } from '@/ai/tools/components';
import { createLogger } from '~logger';
import { CompactToolRenderer } from '@/ai/tools/components';
import type { ToolUIState } from '@/ai/tools/components';
import { createSearchProvider } from '@/search/providers';
import {
    getSearchSettings,
    getApiKeyForProvider,
} from '@/utils/settings/searchSettings';
import type { SearchResults, SearchResultItem, SearchResultImage } from '@/search/types';

const log = createLogger('Tool-DeepWebSearch');

export const DEEP_WEB_SEARCH_TOOL_NAME = 'deepWebSearch';

export const deepSearchSchema = z.object({
    queries: z
        .array(z.string().min(1))
        .min(1)
        .max(5)
        .describe('Array of 2-5 search queries to execute in parallel'),
    search_depth: z
        .enum(['basic', 'advanced'])
        .optional()
        .describe('Search depth: basic or advanced'),
    include_domains: z.array(z.string()).optional().default([]),
    exclude_domains: z.array(z.string()).optional().default([]),
});

export type DeepSearchParams = z.infer<typeof deepSearchSchema>;

const TOOL_DESCRIPTION = `Execute multiple parallel web searches for in-depth research.

USE: For thorough research needing multiple perspectives or complex topics.

REQUIRES:
- queries: Array of 2-5 different search queries exploring different angles
- search_depth: "basic" or "advanced" (optional, default "advanced")

BEHAVIOR: Executes all queries in parallel, aggregates and deduplicates results.

EXAMPLE for "React performance":
queries: ["React performance optimization 2024", "React memo useCallback best practices", "React rendering bottlenecks"]

IMPORTANT: Cite sources using [Source Title](url) format.`;

interface DeepSearchResults extends SearchResults {
    executed_queries: string[];
    unique_results: number;
}


async function executeSingleSearch(
    query: string,
    apiKey: string,
    providerType: 'tavily',
    maxResults: number,
    searchDepth: 'basic' | 'advanced',
    includeDomains: string[],
    excludeDomains: string[]
): Promise<SearchResults> {
    const provider = createSearchProvider(providerType, apiKey);
    try {
        return await provider.search(query, maxResults, searchDepth, includeDomains, excludeDomains);
    } catch (error) {
        log.error('Single search failed', { query: query.substring(0, 50), error: error instanceof Error ? error.message : 'Unknown error' });
        return { results: [], images: [], query, number_of_results: 0 };
    }
}

function deduplicateResults(results: SearchResultItem[]): SearchResultItem[] {
    const seen = new Set<string>();
    return results.filter((result) => {
        const url = result.url.toLowerCase().replace(/\/$/, '');
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
    });
}

function deduplicateImages(images: SearchResultImage[]): SearchResultImage[] {
    const seen = new Set<string>();
    return images.filter((image) => {
        const url = (typeof image === 'string' ? image : image.url).toLowerCase();
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
    });
}


async function executeDeepWebSearch(input: DeepSearchParams): Promise<DeepSearchResults> {
    const { queries, search_depth, include_domains, exclude_domains } = input;

    log.info('executeDeepWebSearch called', { queryCount: queries.length });

    const settings = await getSearchSettings();
    const apiKey = await getApiKeyForProvider(settings.defaultProvider);

    if (!apiKey) {
        log.warn('No API key configured');
        return { results: [], images: [], query: queries.join(' | '), number_of_results: 0, executed_queries: queries, unique_results: 0 };
    }

    const searchDepth = search_depth ?? 'advanced';
    const resultsPerQuery = Math.max(5, Math.floor(15 / queries.length));

    const searchPromises = queries.map((query) =>
        executeSingleSearch(query, apiKey, settings.defaultProvider, resultsPerQuery, searchDepth, include_domains ?? [], exclude_domains ?? [])
    );

    try {
        const allResults = await Promise.all(searchPromises);

        const combinedResults: SearchResultItem[] = [];
        const combinedImages: SearchResultImage[] = [];
        for (const result of allResults) {
            combinedResults.push(...result.results);
            combinedImages.push(...result.images);
        }

        const uniqueResults = deduplicateResults(combinedResults);
        const uniqueImages = settings.includeImages ? deduplicateImages(combinedImages) : [];

        log.info('Deep search completed', { totalBefore: combinedResults.length, unique: uniqueResults.length });

        return {
            results: uniqueResults,
            images: uniqueImages,
            query: queries.join(' | '),
            number_of_results: uniqueResults.length,
            executed_queries: queries,
            unique_results: uniqueResults.length,
        };
    } catch (error) {
        log.error('Deep search failed', { error: error instanceof Error ? error.message : 'Unknown error' });
        return { results: [], images: [], query: queries.join(' | '), number_of_results: 0, executed_queries: queries, unique_results: 0 };
    }
}


export function useDeepWebSearch(): void {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('Registering deep web search tool');

        registerTool({
            name: DEEP_WEB_SEARCH_TOOL_NAME,
            description: TOOL_DESCRIPTION,
            inputSchema: deepSearchSchema,
            execute: executeDeepWebSearch,
        });

        registerToolUI(
            DEEP_WEB_SEARCH_TOOL_NAME,
            (state: ToolUIState) => <CompactToolRenderer state={state} />,
            {
                renderInput: (input: { queries?: string[] }) => (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span style={{ opacity: 0.7 }}>🔍</span>{' '}
                        <span style={{ color: 'var(--text-primary)' }}>
                            Deep search ({input.queries?.length ?? 0} queries)
                        </span>
                    </div>
                ),
                renderOutput: (output: DeepSearchResults) => (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {output.results?.length > 0 ? (
                            <span>Found {output.unique_results} unique results from {output.executed_queries?.length ?? 0} searches</span>
                        ) : (
                            <span style={{ opacity: 0.7 }}>No results found</span>
                        )}
                    </div>
                ),
            }
        );

        return () => {
            log.info('Cleaning up deep web search tool');
            unregisterToolUI(DEEP_WEB_SEARCH_TOOL_NAME);
        };
    }, [registerToolUI, unregisterToolUI]);
}

export default useDeepWebSearch;
