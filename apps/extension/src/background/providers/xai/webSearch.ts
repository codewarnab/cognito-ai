/**
 * xAI Live Search Integration
 * Uses search_parameters in chat completions for real-time web search
 *
 * xAI's Grok models support live search via the `search_parameters` field
 * in chat completions requests. This enables real-time information retrieval
 * from the web and X (Twitter) platform.
 *
 * Reference: https://docs.x.ai/docs/guides/tools/search-tools
 */

import { getXaiApiKey } from '@/utils/credentials';
import { createLogger } from '~logger';

const log = createLogger('XaiWebSearch', 'BACKGROUND');

// ============================================================
// Types
// ============================================================

/**
 * Search parameters configuration for xAI
 */
export interface XaiSearchParameters {
    /** Search mode: 'auto' (model decides), 'on' (always search), 'off' (disable) */
    mode: 'auto' | 'on' | 'off';
    /** Return citations with response */
    return_citations?: boolean;
    /** Start date for search results (YYYY-MM-DD) */
    from_date?: string;
    /** End date for search results (YYYY-MM-DD) */
    to_date?: string;
    /** Maximum number of search results */
    max_search_results?: number;
    /** Only include results from these domains */
    allowed_domains?: string[];
    /** Exclude results from these domains */
    excluded_domains?: string[];
    /** X-specific: include posts from these handles */
    include_x_handles?: string[];
    /** X-specific: exclude posts from these handles */
    exclude_x_handles?: string[];
}

/**
 * Citation from xAI search results
 */
export interface XaiSearchCitation {
    url: string;
    title?: string;
}

/**
 * Processed xAI search result
 */
export interface XaiWebSearchResult {
    /** The text response from Grok */
    text: string;
    /** Extracted citations/sources */
    citations: XaiSearchCitation[];
    /** Whether the search was successful */
    success: boolean;
    /** Error message if search failed */
    error?: string;
}

/**
 * Options for xAI web search
 */
export interface XaiWebSearchOptions {
    /** Model to use (default: grok-3-mini) */
    model?: string;
    /** Search mode (default: auto) */
    mode?: 'auto' | 'on' | 'off';
    /** Maximum search results (default: 5) */
    maxSearchResults?: number;
    /** Restrict searches to these domains */
    allowedDomains?: string[];
    /** Block searches from these domains */
    excludedDomains?: string[];
    /** Date range for search results */
    dateRange?: {
        from?: string;  // YYYY-MM-DD
        to?: string;    // YYYY-MM-DD
    };
}

// ============================================================
// Constants
// ============================================================

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
const DEFAULT_MODEL = 'grok-3-mini';
const DEFAULT_MAX_RESULTS = 5;

// ============================================================
// Implementation
// ============================================================

/**
 * Perform web search using xAI's live search capability
 *
 * xAI live search:
 * 1. Enabled via search_parameters in chat completions
 * 2. Can search web and X (Twitter) content
 * 3. Returns citations when return_citations is true
 *
 * @param query - The search query/prompt
 * @param options - Configuration options
 * @returns Search result with text and citations
 *
 * @example
 * const result = await searchWithXai('What are the latest AI developments?');
 * if (result.success) {
 *   console.log(result.text);
 *   console.log('Sources:', result.citations);
 * }
 */
export async function searchWithXai(
    query: string,
    options: XaiWebSearchOptions = {}
): Promise<XaiWebSearchResult> {
    const apiKey = await getXaiApiKey();
    if (!apiKey) {
        log.error('xAI API key not found for web search');
        return {
            text: '',
            citations: [],
            success: false,
            error: 'xAI API key not configured',
        };
    }

    const {
        model = DEFAULT_MODEL,
        mode = 'auto',
        maxSearchResults = DEFAULT_MAX_RESULTS,
        allowedDomains,
        excludedDomains,
        dateRange,
    } = options;

    log.info('Performing xAI live search', {
        model,
        mode,
        queryLength: query.length,
    });

    try {
        // Build search parameters
        const searchParameters: XaiSearchParameters = {
            mode,
            return_citations: true,
            max_search_results: maxSearchResults,
        };

        if (allowedDomains && allowedDomains.length > 0) {
            searchParameters.allowed_domains = allowedDomains;
        }
        if (excludedDomains && excludedDomains.length > 0) {
            searchParameters.excluded_domains = excludedDomains;
        }
        if (dateRange?.from) {
            searchParameters.from_date = dateRange.from;
        }
        if (dateRange?.to) {
            searchParameters.to_date = dateRange.to;
        }

        const requestBody = {
            model,
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant with access to real-time web search. Use search when the user asks about current events, recent information, or topics that may have changed recently. Cite your sources when using search results.',
                },
                {
                    role: 'user',
                    content: query,
                },
            ],
            search_parameters: searchParameters,
            max_tokens: 4096,
            temperature: 0.7,
        };

        const response = await fetch(XAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('xAI Live Search API error', {
                status: response.status,
                error: errorText,
            });
            return {
                text: '',
                citations: [],
                success: false,
                error: `xAI API error: ${response.status} - ${errorText}`,
            };
        }

        const data = await response.json();

        // Extract text from response
        const text = data.choices?.[0]?.message?.content || '';

        // Extract citations if present
        // xAI returns citations in the response metadata
        const citations: XaiSearchCitation[] = [];
        if (data.citations && Array.isArray(data.citations)) {
            for (const citation of data.citations) {
                citations.push({
                    url: citation.url || citation,
                    title: citation.title,
                });
            }
        }

        log.info('xAI live search completed successfully', {
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
        log.error('xAI live search failed', { error: errorMessage });
        return {
            text: '',
            citations: [],
            success: false,
            error: errorMessage,
        };
    }
}

/**
 * Check if xAI web search is available
 * @returns true if xAI API key is configured
 */
export async function isXaiWebSearchAvailable(): Promise<boolean> {
    try {
        const apiKey = await getXaiApiKey();
        return !!apiKey;
    } catch {
        return false;
    }
}

/**
 * Get search parameters configuration for inclusion in requests
 *
 * Use this when you want to add live search to an existing xAI request.
 *
 * @param options - Configuration options
 * @returns XaiSearchParameters for xAI API request
 */
export function getXaiSearchParameters(
    options: XaiWebSearchOptions = {}
): XaiSearchParameters {
    const params: XaiSearchParameters = {
        mode: options.mode ?? 'auto',
        return_citations: true,
        max_search_results: options.maxSearchResults ?? DEFAULT_MAX_RESULTS,
    };

    if (options.allowedDomains) {
        params.allowed_domains = options.allowedDomains;
    }
    if (options.excludedDomains) {
        params.excluded_domains = options.excludedDomains;
    }
    if (options.dateRange?.from) {
        params.from_date = options.dateRange.from;
    }
    if (options.dateRange?.to) {
        params.to_date = options.dateRange.to;
    }

    return params;
}

/**
 * Format xAI search citations for inclusion in prompts
 *
 * @param citations - Array of citations from search
 * @returns Formatted string for prompt enrichment
 */
export function formatXaiCitationsForPrompt(
    citations: XaiSearchCitation[]
): string {
    if (citations.length === 0) {
        return '';
    }

    return '\n\nSources:\n' + citations
        .map((c, i) => `[${i + 1}] ${c.title || c.url}: ${c.url}`)
        .join('\n');
}
