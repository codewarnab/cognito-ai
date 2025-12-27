/**
 * Anthropic Web Search Integration
 * Uses the server-side web_search_20250305 tool
 *
 * Unlike OpenAI's Responses API (pre-search approach), Anthropic's web search
 * is a tool that Claude invokes during generation. This means:
 *
 * 1. We include the web_search tool in the request
 * 2. Claude decides when to search
 * 3. Results are returned as part of the response with citations
 *
 * Reference: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
 */

import { getAnthropicApiKey } from '@/utils/credentials';
import { createLogger } from '~logger';

const log = createLogger('AnthropicWebSearch', 'BACKGROUND');

// ============================================================
// Types
// ============================================================

/**
 * Web search tool configuration for Anthropic
 */
interface WebSearchToolConfig {
    type: 'web_search_20250305';
    name: 'web_search';
    max_uses?: number;
    allowed_domains?: string[];
    blocked_domains?: string[];
    user_location?: {
        type: 'approximate';
        city?: string;
        region?: string;
        country?: string;
        timezone?: string;
    };
}

/**
 * Anthropic Messages API request body with web search tool
 */
interface WebSearchRequest {
    model: string;
    max_tokens: number;
    system?: string | SystemContentBlock[];
    messages: Array<{ role: string; content: string }>;
    tools: WebSearchToolConfig[];
}

/**
 * System content block with cache control for prompt caching
 */
interface SystemContentBlock {
    type: 'text';
    text: string;
    cache_control?: { type: 'ephemeral' };
}

/**
 * Citation from web search results
 */
interface WebSearchCitation {
    type: 'web_search_result_location';
    url: string;
    title: string;
    cited_text: string;
}

/**
 * Content block in Anthropic response
 */
interface ContentBlock {
    type: 'text' | 'server_tool_use' | 'web_search_tool_result';
    text?: string;
    citations?: WebSearchCitation[];
}

/**
 * Anthropic Messages API response structure
 */
interface WebSearchResponse {
    id?: string;
    type?: string;
    role?: string;
    content: ContentBlock[];
    stop_reason: string;
}

/**
 * Processed web search result
 */
export interface AnthropicWebSearchResult {
    /** The text response from Claude */
    text: string;
    /** Extracted citations/sources */
    citations: Array<{ url: string; title?: string; cited_text?: string }>;
    /** Whether the search was successful */
    success: boolean;
    /** Error message if search failed */
    error?: string;
}

/**
 * Options for Anthropic web search
 */
export interface AnthropicWebSearchOptions {
    /** Model to use (default: claude-haiku-4-5) */
    model?: string;
    /** Maximum number of searches Claude can perform (default: 3) */
    maxUses?: number;
    /** Restrict searches to these domains */
    allowedDomains?: string[];
    /** Block searches from these domains */
    blockedDomains?: string[];
    /** User location for localized results */
    userLocation?: {
        city?: string;
        region?: string;
        country?: string;
        timezone?: string;
    };
}

// ============================================================
// Constants
// ============================================================

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5';
const DEFAULT_MAX_USES = 2;
const ANTHROPIC_VERSION = '2023-06-01';

// ============================================================
// Implementation
// ============================================================

/**
 * Perform web-enhanced generation using Anthropic's web search tool
 *
 * This differs from OpenAI's approach:
 * - OpenAI: Pre-search with Responses API, then enrich prompt
 * - Anthropic: Include web_search tool, Claude decides when to search
 *
 * @param query - The query/prompt for Claude (Claude will search if needed)
 * @param options - Configuration options
 * @returns Web search result with text and citations
 *
 * @example
 * const result = await searchWithAnthropic('What are the latest AI developments?');
 * if (result.success) {
 *   console.log(result.text);
 *   console.log('Sources:', result.citations);
 * }
 */
export async function searchWithAnthropic(
    query: string,
    options: AnthropicWebSearchOptions = {}
): Promise<AnthropicWebSearchResult> {
    const apiKey = await getAnthropicApiKey();
    if (!apiKey) {
        log.error('Anthropic API key not found for web search');
        return {
            text: '',
            citations: [],
            success: false,
            error: 'Anthropic API key not configured',
        };
    }

    const {
        model = DEFAULT_MODEL,
        maxUses = DEFAULT_MAX_USES,
        allowedDomains,
        blockedDomains,
        userLocation,
    } = options;

    log.info('Performing Anthropic web search', {
        model,
        maxUses,
        queryLength: query.length,
    });

    try {
        // Build web search tool configuration
        const webSearchTool: WebSearchToolConfig = {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: maxUses,
        };

        if (allowedDomains && allowedDomains.length > 0) {
            webSearchTool.allowed_domains = allowedDomains;
        }
        if (blockedDomains && blockedDomains.length > 0) {
            webSearchTool.blocked_domains = blockedDomains;
        }
        if (userLocation) {
            webSearchTool.user_location = {
                type: 'approximate',
                ...userLocation,
            };
        }

        // Use prompt caching for the system prompt to reduce costs
        const systemBlocks: SystemContentBlock[] = [
            {
                type: 'text',
                text: 'You are a helpful assistant with access to web search. Use web search when the user asks about current events, recent information, or topics that may have changed since your knowledge cutoff. Always cite your sources when using web search results.',
                cache_control: { type: 'ephemeral' },
            },
        ];

        const requestBody: WebSearchRequest = {
            model,
            max_tokens: 4096,
            system: systemBlocks,
            messages: [
                { role: 'user', content: query }
            ],
            tools: [webSearchTool],
        };

        const response = await fetch(ANTHROPIC_MESSAGES_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': ANTHROPIC_VERSION,
                // Enable prompt caching beta
                'anthropic-beta': 'prompt-caching-2024-07-31',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('Anthropic Web Search API error', {
                status: response.status,
                error: errorText,
            });
            return {
                text: '',
                citations: [],
                success: false,
                error: `Anthropic API error: ${response.status} - ${errorText}`,
            };
        }

        const data: WebSearchResponse = await response.json();

        // Extract text and citations from response
        let text = '';
        const citations: Array<{ url: string; title?: string; cited_text?: string }> = [];

        for (const block of data.content) {
            if (block.type === 'text') {
                text += block.text ?? '';

                // Extract citations from text block
                if (block.citations) {
                    for (const citation of block.citations) {
                        if (citation.type === 'web_search_result_location') {
                            citations.push({
                                url: citation.url,
                                title: citation.title,
                                cited_text: citation.cited_text,
                            });
                        }
                    }
                }
            }
        }

        log.info('Anthropic web search completed successfully', {
            textLength: text.length,
            citationCount: citations.length,
        });

        return {
            text,
            citations,
            success: true,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log.error('Anthropic web search failed', { error: errorMessage });
        return {
            text: '',
            citations: [],
            success: false,
            error: errorMessage,
        };
    }
}

/**
 * Check if Anthropic web search is available
 * @returns true if Anthropic API key is configured
 */
export async function isAnthropicWebSearchAvailable(): Promise<boolean> {
    try {
        const apiKey = await getAnthropicApiKey();
        return !!apiKey;
    } catch {
        return false;
    }
}

/**
 * Format web search citations for inclusion in prompts
 *
 * @param citations - Array of citations from web search
 * @returns Formatted string for prompt enrichment
 */
export function formatAnthropicCitationsForPrompt(
    citations: Array<{ url: string; title?: string; cited_text?: string }>
): string {
    if (citations.length === 0) {
        return '';
    }

    return '\n\nSources:\n' + citations
        .map((c, i) => `[${i + 1}] ${c.title || c.url}: ${c.url}${c.cited_text ? `\n   "${c.cited_text}"` : ''}`)
        .join('\n');
}

/**
 * Get web search tool configuration for inclusion in requests
 *
 * Use this when you want Claude to have web search available during generation,
 * but let Claude decide when to use it.
 *
 * @param options - Configuration options
 * @returns WebSearchToolConfig for Anthropic API request
 */
export function getWebSearchToolConfig(
    options: AnthropicWebSearchOptions = {}
): WebSearchToolConfig {
    const config: WebSearchToolConfig = {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: options.maxUses ?? DEFAULT_MAX_USES,
    };

    if (options.allowedDomains) {
        config.allowed_domains = options.allowedDomains;
    }
    if (options.blockedDomains) {
        config.blocked_domains = options.blockedDomains;
    }
    if (options.userLocation) {
        config.user_location = {
            type: 'approximate',
            ...options.userLocation,
        };
    }

    return config;
}
