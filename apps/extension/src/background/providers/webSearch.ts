/**
 * Unified Web Search Abstraction
 * Routes web search to the appropriate provider implementation
 *
 * Different providers implement web search differently:
 * - Google/Vertex: Built-in `google_search` tool (handled in request body)
 * - OpenAI: Responses API with web_search tool (pre-search approach)
 * - Anthropic: Server-side web_search_20250305 tool (pre-search approach)
 * - Perplexity: Native search (future support)
 *
 * This module provides a unified interface for web search across providers.
 */

import { getWebSearchImplementation } from './capabilities';
import {
    searchWithOpenAI,
    formatCitationsForPrompt,
    type WebSearchResult,
    type WebSearchCitation,
} from './openai/webSearch';
import {
    searchWithAnthropic,
    formatAnthropicCitationsForPrompt,
} from './anthropic/webSearch';
import {
    searchWithXai,
} from './xai/webSearch';
import { createLogger } from '~logger';

const log = createLogger('WebSearch', 'BACKGROUND');

// Re-export types for consumers
export type { WebSearchResult, WebSearchCitation };

// Re-export formatters for consumers
export { formatCitationsForPrompt, formatAnthropicCitationsForPrompt };

/**
 * Result from performWebSearch
 * For built-in tools, returns configuration for the request body
 * For API-based search, returns the search results
 */
export type WebSearchRouteResult =
    | { type: 'builtin'; toolConfig: Record<string, unknown> }
    | { type: 'presearch'; result: WebSearchResult }
    | { type: 'native' }
    | { type: 'unavailable'; reason: string };

/**
 * Options for web search
 */
export interface WebSearchOptions {
    /** Search context size for OpenAI (default: medium) */
    searchContextSize?: 'low' | 'medium' | 'high';
}

/**
 * Perform web search using the appropriate implementation for the provider
 *
 * @param provider - The AI provider type (google, vertex, openai, etc.)
 * @param query - The search query
 * @param options - Optional configuration
 * @returns WebSearchRouteResult indicating how to handle the search
 *
 * @example
 * // For OpenAI - returns pre-search results
 * const result = await performWebSearch('openai', 'latest news');
 * if (result.type === 'presearch') {
 *   const enrichedPrompt = enrichPromptWithSearch(prompt, result.result);
 * }
 *
 * @example
 * // For Gemini - returns tool config for request body
 * const result = await performWebSearch('google', 'latest news');
 * if (result.type === 'builtin') {
 *   tools.push(result.toolConfig);
 * }
 */
export async function performWebSearch(
    provider: string,
    query: string,
    options: WebSearchOptions = {}
): Promise<WebSearchRouteResult> {
    const implementation = getWebSearchImplementation(provider);

    log.debug('Routing web search', { provider, implementation });

    switch (implementation) {
        case 'google_search':
            // Gemini handles this via built-in tool
            // Return the tool configuration to be added to the request
            return {
                type: 'builtin',
                toolConfig: { google_search: {} },
            };

        case 'openai_responses':
            // OpenAI uses Responses API - perform pre-search
            log.info('Performing OpenAI web search');
            const result = await searchWithOpenAI(query, {
                searchContextSize: options.searchContextSize ?? 'medium',
            });
            return {
                type: 'presearch',
                result,
            };

        case 'anthropic_server_tool':
            // Anthropic uses server-side web_search_20250305 tool
            log.info('Performing Anthropic web search');
            const anthropicResult = await searchWithAnthropic(query, {
                maxUses: 3,
            });
            return {
                type: 'presearch',
                result: {
                    text: anthropicResult.text,
                    citations: anthropicResult.citations.map(c => ({
                        url: c.url,
                        title: c.title,
                    })),
                    success: anthropicResult.success,
                    error: anthropicResult.error,
                },
            };

        case 'xai_live_search':
            // xAI uses live search via search_parameters
            log.info('Performing xAI live search');
            const xaiResult = await searchWithXai(query, {
                maxSearchResults: 5,
            });
            return {
                type: 'presearch',
                result: {
                    text: xaiResult.text,
                    citations: xaiResult.citations.map(c => ({
                        url: c.url,
                        title: c.title,
                    })),
                    success: xaiResult.success,
                    error: xaiResult.error,
                },
            };

        case 'native':
            // Provider handles search internally - no action needed
            return { type: 'native' };

        default:
            return {
                type: 'unavailable',
                reason: `Web search not available for provider: ${provider}`,
            };
    }
}

/**
 * Enrich a prompt with web search results
 *
 * @param prompt - Original prompt
 * @param searchResult - Result from OpenAI web search
 * @returns Enriched prompt with search context
 */
export function enrichPromptWithSearch(
    prompt: string,
    searchResult: WebSearchResult
): string {
    if (!searchResult.success || !searchResult.text) {
        return prompt;
    }

    const citations = formatCitationsForPrompt(searchResult.citations);

    return `Based on the following web search results:

${searchResult.text}
${citations}

---

Original request:
${prompt}`;
}

/**
 * Check if web search is available for a provider
 *
 * @param provider - The AI provider type
 * @returns true if the provider supports web search
 */
export function isWebSearchAvailable(provider: string): boolean {
    const implementation = getWebSearchImplementation(provider);
    return implementation !== 'none';
}
