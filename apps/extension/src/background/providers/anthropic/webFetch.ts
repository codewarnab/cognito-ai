/**
 * Anthropic Web Fetch Integration
 * Uses the server-side web_fetch_20250910 tool for URL content retrieval
 *
 * This is Claude's equivalent of Gemini's `url_context` tool.
 * It allows Claude to fetch and analyze content from URLs during generation.
 *
 * Reference: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool
 */

import { getAnthropicApiKey } from '@/utils/credentials';
import { createLogger } from '~logger';

const log = createLogger('AnthropicWebFetch', 'BACKGROUND');

// ============================================================
// Types
// ============================================================

/**
 * Web fetch tool configuration for Anthropic
 */
export interface WebFetchToolConfig {
    type: 'web_fetch_20250910';
    name: 'web_fetch';
    max_uses?: number;
    allowed_domains?: string[];
    blocked_domains?: string[];
    citations?: { enabled: boolean };
    max_content_tokens?: number;
}

/**
 * Anthropic Messages API request body with web fetch tool
 */
interface WebFetchRequest {
    model: string;
    max_tokens: number;
    system?: string | SystemContentBlock[];
    messages: Array<{ role: string; content: string }>;
    tools: WebFetchToolConfig[];
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
 * Content block in Anthropic response
 */
interface ContentBlock {
    type: 'text' | 'server_tool_use' | 'web_fetch_tool_result';
    text?: string;
    citations?: Array<{
        type: 'url_citation';
        url: string;
        title?: string;
        cited_text?: string;
    }>;
}

/**
 * Anthropic Messages API response structure
 */
interface WebFetchResponse {
    id?: string;
    type?: string;
    role?: string;
    content: ContentBlock[];
    stop_reason: string;
}

/**
 * Processed web fetch result
 */
export interface AnthropicWebFetchResult {
    /** The text response from Claude */
    text: string;
    /** Extracted citations/sources from fetched URLs */
    citations: Array<{ url: string; title?: string; cited_text?: string }>;
    /** Whether the fetch was successful */
    success: boolean;
    /** Error message if fetch failed */
    error?: string;
}

/**
 * Options for Anthropic web fetch
 */
export interface AnthropicWebFetchOptions {
    /** Model to use (default: claude-haiku-4-5) */
    model?: string;
    /** Maximum number of fetches Claude can perform (default: 3) */
    maxUses?: number;
    /** Restrict fetches to these domains */
    allowedDomains?: string[];
    /** Block fetches from these domains */
    blockedDomains?: string[];
    /** Enable citations for fetched content (default: true) */
    enableCitations?: boolean;
    /** Maximum content length in tokens */
    maxContentTokens?: number;
}

// ============================================================
// Constants
// ============================================================

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5';
const DEFAULT_MAX_USES = 3;
const ANTHROPIC_VERSION = '2023-06-01';
const WEB_FETCH_BETA_HEADER = 'web-fetch-2025-09-10';

// ============================================================
// Implementation
// ============================================================

/**
 * Perform URL content fetching using Anthropic's web fetch tool
 *
 * Claude's web_fetch tool:
 * 1. Retrieves full text content from specified URLs
 * 2. Performs automatic text extraction for PDFs
 * 3. Does NOT support JavaScript-rendered pages
 *
 * @param prompt - The prompt/query that may reference URLs
 * @param options - Configuration options
 * @returns Web fetch result with text and citations
 *
 * @example
 * const result = await fetchWithAnthropic('Summarize the content at https://example.com/article');
 * if (result.success) {
 *   console.log(result.text);
 *   console.log('Sources:', result.citations);
 * }
 */
export async function fetchWithAnthropic(
    prompt: string,
    options: AnthropicWebFetchOptions = {}
): Promise<AnthropicWebFetchResult> {
    const apiKey = await getAnthropicApiKey();
    if (!apiKey) {
        log.error('Anthropic API key not found for web fetch');
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
        enableCitations = true,
        maxContentTokens,
    } = options;

    log.info('Performing Anthropic web fetch', {
        model,
        maxUses,
        promptLength: prompt.length,
    });

    try {
        // Build web fetch tool configuration
        const webFetchTool: WebFetchToolConfig = {
            type: 'web_fetch_20250910',
            name: 'web_fetch',
            max_uses: maxUses,
        };

        if (allowedDomains && allowedDomains.length > 0) {
            webFetchTool.allowed_domains = allowedDomains;
        }
        if (blockedDomains && blockedDomains.length > 0) {
            webFetchTool.blocked_domains = blockedDomains;
        }
        if (enableCitations) {
            webFetchTool.citations = { enabled: true };
        }
        if (maxContentTokens) {
            webFetchTool.max_content_tokens = maxContentTokens;
        }

        // Use prompt caching for the system prompt to reduce costs
        const systemBlocks: SystemContentBlock[] = [
            {
                type: 'text',
                text: 'You are a helpful assistant with access to web fetch. Use web fetch when URLs are provided or when the user asks to analyze content from specific web pages. Cite your sources when using fetched content.',
                cache_control: { type: 'ephemeral' },
            },
        ];

        const requestBody: WebFetchRequest = {
            model,
            max_tokens: 4096,
            system: systemBlocks,
            messages: [
                { role: 'user', content: prompt }
            ],
            tools: [webFetchTool],
        };

        const response = await fetch(ANTHROPIC_MESSAGES_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': ANTHROPIC_VERSION,
                // Enable web fetch beta and prompt caching
                'anthropic-beta': `${WEB_FETCH_BETA_HEADER},prompt-caching-2024-07-31`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('Anthropic Web Fetch API error', {
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

        const data: WebFetchResponse = await response.json();

        // Extract text and citations from response
        let text = '';
        const citations: Array<{ url: string; title?: string; cited_text?: string }> = [];

        for (const block of data.content) {
            if (block.type === 'text') {
                text += block.text ?? '';

                // Extract citations from text block
                if (block.citations) {
                    for (const citation of block.citations) {
                        if (citation.type === 'url_citation') {
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

        log.info('Anthropic web fetch completed successfully', {
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
        log.error('Anthropic web fetch failed', { error: errorMessage });
        return {
            text: '',
            citations: [],
            success: false,
            error: errorMessage,
        };
    }
}

/**
 * Check if Anthropic web fetch is available
 * @returns true if Anthropic API key is configured
 */
export async function isAnthropicWebFetchAvailable(): Promise<boolean> {
    try {
        const apiKey = await getAnthropicApiKey();
        return !!apiKey;
    } catch {
        return false;
    }
}

/**
 * Get web fetch tool configuration for inclusion in requests
 *
 * Use this when you want Claude to have web fetch available during generation,
 * but let Claude decide when to use it.
 *
 * @param options - Configuration options
 * @returns WebFetchToolConfig for Anthropic API request
 */
export function getWebFetchToolConfig(
    options: AnthropicWebFetchOptions = {}
): WebFetchToolConfig {
    const config: WebFetchToolConfig = {
        type: 'web_fetch_20250910',
        name: 'web_fetch',
        max_uses: options.maxUses ?? DEFAULT_MAX_USES,
    };

    if (options.allowedDomains) {
        config.allowed_domains = options.allowedDomains;
    }
    if (options.blockedDomains) {
        config.blocked_domains = options.blockedDomains;
    }
    if (options.enableCitations !== false) {
        config.citations = { enabled: true };
    }
    if (options.maxContentTokens) {
        config.max_content_tokens = options.maxContentTokens;
    }

    return config;
}

/**
 * Format web fetch citations for inclusion in prompts
 *
 * @param citations - Array of citations from web fetch
 * @returns Formatted string for prompt enrichment
 */
export function formatWebFetchCitationsForPrompt(
    citations: Array<{ url: string; title?: string; cited_text?: string }>
): string {
    if (citations.length === 0) {
        return '';
    }

    return '\n\nFetched Sources:\n' + citations
        .map((c, i) => `[${i + 1}] ${c.title || c.url}: ${c.url}${c.cited_text ? `\n   "${c.cited_text}"` : ''}`)
        .join('\n');
}
