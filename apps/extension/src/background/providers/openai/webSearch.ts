/**
 * OpenAI Web Search Integration
 * Uses the Responses API with web_search tool
 *
 * Reference: https://platform.openai.com/docs/guides/tools-web-search
 *
 * NOTE: This module provides web search functionality for OpenAI provider,
 * enabling real-time web information retrieval to enrich AI responses.
 */

import { getOpenAIApiKey } from '@/utils/credentials';
import { createLogger } from '~logger';

const log = createLogger('OpenAIWebSearch', 'BACKGROUND');

// ============================================================
// Types
// ============================================================

/**
 * OpenAI Responses API request body for web search
 */
interface WebSearchRequest {
    model: string;
    tools: Array<WebSearchTool>;
    input: string;
}

/**
 * Web search tool configuration
 */
interface WebSearchTool {
    type: 'web_search';
    search_context_size?: 'low' | 'medium' | 'high';
}

/**
 * OpenAI Responses API response structure
 */
interface WebSearchResponse {
    id: string;
    output: Array<WebSearchOutputItem>;
}

interface WebSearchOutputItem {
    type: 'message';
    id: string;
    role: 'assistant';
    content: Array<WebSearchContentItem>;
}

interface WebSearchContentItem {
    type: 'output_text';
    text: string;
    annotations?: Array<WebSearchAnnotation>;
}

interface WebSearchAnnotation {
    type: 'url_citation';
    url: string;
    title?: string;
    start_index: number;
    end_index: number;
}

/**
 * Processed web search result
 */
export interface WebSearchResult {
    /** The text response from the AI */
    text: string;
    /** Extracted citations/sources */
    citations: Array<WebSearchCitation>;
    /** Whether the search was successful */
    success: boolean;
    /** Error message if search failed */
    error?: string;
}

export interface WebSearchCitation {
    url: string;
    title?: string;
}

/**
 * Options for OpenAI web search
 */
export interface OpenAIWebSearchOptions {
    /** Model to use (default: gpt-4o) */
    model?: string;
    /** Amount of search context to include (default: medium) */
    searchContextSize?: 'low' | 'medium' | 'high';
}

// ============================================================
// Constants
// ============================================================

const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_SEARCH_CONTEXT_SIZE: 'low' | 'medium' | 'high' = 'medium';

// ============================================================
// Implementation
// ============================================================

/**
 * Perform web search using OpenAI Responses API
 *
 * @param query - The search query or question
 * @param options - Optional configuration
 * @returns WebSearchResult with text and citations
 *
 * @example
 * const result = await searchWithOpenAI('What are the latest AI developments?');
 * if (result.success) {
 *   console.log(result.text);
 *   console.log('Sources:', result.citations);
 * }
 */
export async function searchWithOpenAI(
    query: string,
    options: OpenAIWebSearchOptions = {}
): Promise<WebSearchResult> {
    const apiKey = await getOpenAIApiKey();
    if (!apiKey) {
        log.error('OpenAI API key not found for web search');
        return {
            text: '',
            citations: [],
            success: false,
            error: 'OpenAI API key not configured',
        };
    }

    const {
        model = DEFAULT_MODEL,
        searchContextSize = DEFAULT_SEARCH_CONTEXT_SIZE,
    } = options;

    log.info('Performing OpenAI web search', {
        model,
        searchContextSize,
        queryLength: query.length,
    });

    try {
        const requestBody: WebSearchRequest = {
            model,
            tools: [{
                type: 'web_search',
                search_context_size: searchContextSize,
            }],
            input: query,
        };

        const response = await fetch(OPENAI_RESPONSES_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('OpenAI Web Search API error', {
                status: response.status,
                error: errorText,
            });
            return {
                text: '',
                citations: [],
                success: false,
                error: `OpenAI API error: ${response.status} - ${errorText}`,
            };
        }

        const data: WebSearchResponse = await response.json();

        // Extract text and citations from response
        const messageOutput = data.output?.find(o => o.type === 'message');
        const textContent = messageOutput?.content?.find(c => c.type === 'output_text');

        const text = textContent?.text ?? '';
        const citations: WebSearchCitation[] = (textContent?.annotations ?? [])
            .filter((a): a is WebSearchAnnotation => a.type === 'url_citation')
            .map(a => ({
                url: a.url,
                title: a.title,
            }));

        log.info('OpenAI web search completed successfully', {
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
        log.error('OpenAI web search failed', { error: errorMessage });
        return {
            text: '',
            citations: [],
            success: false,
            error: errorMessage,
        };
    }
}

/**
 * Check if OpenAI web search is available
 * @returns true if OpenAI API key is configured
 */
export async function isOpenAIWebSearchAvailable(): Promise<boolean> {
    try {
        const apiKey = await getOpenAIApiKey();
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
export function formatCitationsForPrompt(citations: WebSearchCitation[]): string {
    if (citations.length === 0) {
        return '';
    }

    return '\n\nSources:\n' + citations
        .map((c, i) => `[${i + 1}] ${c.title || c.url}: ${c.url}`)
        .join('\n');
}
