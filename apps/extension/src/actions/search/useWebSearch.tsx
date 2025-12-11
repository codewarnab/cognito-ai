/**
 * Web Search Tool
 * Allows AI to search the web for current information
 * 
 * AI SDK v5: Uses inputSchema (not parameters) for tool definition
 */

import { useEffect } from 'react';
import { registerTool } from '@/ai/tools';
import { useToolUI } from '@/ai/tools/components';
import { createLogger } from '~logger';
import { CompactToolRenderer } from '@/ai/tools/components';
import type { ToolUIState } from '@/ai/tools/components';
import { createSearchProvider } from '@/search/providers';
import { searchSchema, type SearchParams } from '@/search/schema';
import {
    getSearchSettings,
    getApiKeyForProvider,
} from '@/utils/settings/searchSettings';
import type { SearchResults } from '@/search/types';

const log = createLogger('Tool-WebSearch');

/** Tool name constant */
export const WEB_SEARCH_TOOL_NAME = 'webSearch';

/**
 * Tool description following the USE/REQUIRES/BEHAVIOR/RETURNS format.
 */
const TOOL_DESCRIPTION = `Search the web for current information, news, facts, or any topic.

USE: When you need up-to-date information, recent news, facts you're uncertain about, or information that may have changed since your knowledge cutoff.

REQUIRES:
- query: The search query (required, minimum 1 character)
- max_results: Number of results to return (optional, 1-20, default 10)
- search_depth: "basic" for quick results or "advanced" for thorough search (optional, default "basic")
- include_domains: Array of domains to include (optional, e.g., ["reddit.com"])
- exclude_domains: Array of domains to exclude (optional, e.g., ["pinterest.com"])

BEHAVIOR:
1. Sends query to web search API
2. Returns results with titles, URLs, and content snippets
3. May include relevant images
4. Use "advanced" search_depth for complex queries or when basic search doesn't find good results

RETURNS: Object with results array containing {title, url, content} objects, images array, query string, and number_of_results.

IMPORTANT: Always cite sources in your response using [Source Title](url) format when using information from search results.`;

/**
 * Execute web search using configured provider.
 * AI SDK v5: Input is typed from searchSchema (SearchParams)
 */
async function executeWebSearch(input: SearchParams): Promise<SearchResults> {
    // Destructure input with defaults from schema
    const {
        query,
        max_results,
        search_depth,
        include_domains,
        exclude_domains,
    } = input;
    
    log.info('🔍 executeWebSearch called with input', {
        query: query.substring(0, 50),
        search_depth_from_input: search_depth,
        max_results_from_input: max_results,
    });
    
    const settings = await getSearchSettings();
    
    log.info('🔍 Settings loaded from storage', {
        defaultSearchDepth: settings.defaultSearchDepth,
        maxResults: settings.maxResults,
        provider: settings.defaultProvider,
    });
    
    const apiKey = await getApiKeyForProvider(settings.defaultProvider);

    if (!apiKey) {
        log.warn('No API key configured for search provider', {
            provider: settings.defaultProvider,
        });
        return {
            results: [],
            images: [],
            query,
            number_of_results: 0,
        };
    }

    const provider = createSearchProvider(settings.defaultProvider, apiKey);

    const maxResults = max_results ?? settings.maxResults;
    const searchDepth = search_depth ?? settings.defaultSearchDepth;

    log.info('🔍 Final search parameters', {
        query: query.substring(0, 50),
        search_depth_from_input: search_depth,
        settings_defaultSearchDepth: settings.defaultSearchDepth,
        final_searchDepth: searchDepth,
        maxResults,
        provider: settings.defaultProvider,
    });

    try {
        const results = await provider.search(
            query,
            maxResults,
            searchDepth,
            include_domains ?? [],
            exclude_domains ?? []
        );

        // Filter out images if disabled in settings
        if (!settings.includeImages) {
            results.images = [];
        }

        log.info('Web search completed', {
            resultCount: results.results.length,
            imageCount: results.images.length,
        });

        return results;
    } catch (error) {
        log.error('Web search failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return {
            results: [],
            images: [],
            query,
            number_of_results: 0,
        };
    }
}

/**
 * Hook to register the web search tool with the AI system.
 */
export function useWebSearch(): void {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('Registering web search tool');

        // AI SDK v5: Use inputSchema instead of parameters
        registerTool({
            name: WEB_SEARCH_TOOL_NAME,
            description: TOOL_DESCRIPTION,
            inputSchema: searchSchema,
            execute: executeWebSearch,
        });

        // Register the UI renderer
        registerToolUI(
            WEB_SEARCH_TOOL_NAME,
            (state: ToolUIState) => <CompactToolRenderer state={state} />,
            {
                renderInput: (input: { query?: string; search_depth?: string }) => (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                        }}
                    >
                        <span style={{ opacity: 0.7 }}>🔍</span>
                        <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                            "{input.query}"
                        </span>
                        {input.search_depth === 'advanced' && (
                            <span
                                style={{
                                    fontSize: '10px',
                                    padding: '1px 4px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '3px',
                                    opacity: 0.7,
                                }}
                            >
                                advanced
                            </span>
                        )}
                    </div>
                ),
                renderOutput: (output: SearchResults) => (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {output.results && output.results.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ opacity: 0.7 }}>
                                    Found {output.results.length} result
                                    {output.results.length !== 1 ? 's' : ''}
                                    {output.images && output.images.length > 0 &&
                                        ` + ${output.images.length} image${output.images.length !== 1 ? 's' : ''}`}
                                </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px',
                                        maxHeight: '200px',
                                        overflowY: 'auto',
                                    }}
                                >
                                    {output.results.slice(0, 5).map((result, index) => (
                                        <div
                                            key={`${result.url}-${index}`}
                                            style={{
                                                padding: '6px 8px',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: '3px',
                                                border: '1px solid var(--border-color)',
                                                fontSize: '11px',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    color: 'var(--text-primary)',
                                                    opacity: 0.9,
                                                    marginBottom: '2px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {result.title}
                                            </div>
                                            <a
                                                href={result.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    fontSize: '10px',
                                                    opacity: 0.6,
                                                    textDecoration: 'none',
                                                    display: 'block',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {result.url}
                                            </a>
                                        </div>
                                    ))}
                                    {output.results.length > 5 && (
                                        <div style={{ opacity: 0.5, fontSize: '10px' }}>
                                            +{output.results.length - 5} more results
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <span style={{ opacity: 0.7 }}>No results found</span>
                        )}
                    </div>
                ),
            }
        );

        log.info('Web search tool registration complete');

        return () => {
            log.info('Cleaning up web search tool');
            unregisterToolUI(WEB_SEARCH_TOOL_NAME);
        };
    }, [registerToolUI, unregisterToolUI]);
}

export default useWebSearch;
