/**
 * URL Retrieve Tool
 * Allows AI to retrieve and extract content from a specific URL
 * 
 * AI SDK v5: Uses inputSchema (not parameters) for tool definition
 */

import { useEffect } from 'react';
import { registerTool } from '@/ai/tools';
import { useToolUI } from '@/ai/tools/components';
import { createLogger } from '~logger';
import { CompactToolRenderer } from '@/ai/tools/components';
import type { ToolUIState } from '@/ai/tools/components';
import { retrieveSchema, type RetrieveParams } from '@/search/schema';
import type { SearchResults } from '@/search/types';

const log = createLogger('Tool-Retrieve');

/** Tool name constant */
export const RETRIEVE_TOOL_NAME = 'retrieve';

/** Maximum characters to extract from a page */
const CONTENT_CHARACTER_LIMIT = 10000;

/** Jina Reader API for content extraction */
const JINA_READER_URL = 'https://r.jina.ai';

/**
 * Tool description following the USE/REQUIRES/BEHAVIOR/RETURNS format.
 */
const TOOL_DESCRIPTION = `Retrieve and extract the main content from a web page URL.

USE: When you need to read the full content of a specific URL, such as an article, documentation page, or blog post.

REQUIRES:
- url: The complete URL to retrieve content from (required, must be a valid URL)

BEHAVIOR:
1. Fetches the URL content using Jina Reader API
2. Extracts main content, removing navigation, ads, and boilerplate
3. Truncates content to ${CONTENT_CHARACTER_LIMIT} characters if necessary
4. Returns structured result with title, content, and URL

RETURNS: Object with results array containing single {title, url, content} object.

NOTE: Use this for deep-diving into specific URLs found from web search. Do not use for general searches.`;

/**
 * Fetch content from URL using Jina Reader API.
 */
async function fetchJinaReaderData(url: string): Promise<SearchResults | null> {
    try {
        log.info('Fetching URL content via Jina Reader', {
            url: url.substring(0, 100),
        });

        const response = await fetch(`${JINA_READER_URL}/${url}`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'X-With-Generated-Alt': 'true',
            },
        });

        if (!response.ok) {
            log.warn('Jina Reader returned non-OK status', {
                status: response.status,
            });
            return null;
        }

        const json = await response.json();

        if (!json.data || !json.data.content) {
            log.warn('Jina Reader returned empty content');
            return null;
        }

        const content = json.data.content.slice(0, CONTENT_CHARACTER_LIMIT);

        return {
            results: [
                {
                    title: json.data.title || 'Retrieved Content',
                    content,
                    url: json.data.url || url,
                },
            ],
            query: '',
            images: [],
        };
    } catch (error) {
        log.error('Jina Reader API error', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return null;
    }
}

/**
 * Execute URL content retrieval.
 * AI SDK v5: Input is typed from retrieveSchema (RetrieveParams)
 */
async function executeRetrieve(input: RetrieveParams): Promise<SearchResults> {
    const { url } = input;
    
    log.info('Executing URL retrieve', { url: url.substring(0, 100) });

    const results = await fetchJinaReaderData(url);

    if (!results) {
        log.warn('Failed to retrieve URL content', { url });
        return {
            results: [],
            images: [],
            query: '',
            number_of_results: 0,
        };
    }

    log.info('URL retrieve completed', {
        title: results.results[0]?.title?.substring(0, 50),
        contentLength: results.results[0]?.content?.length,
    });

    return results;
}

/**
 * Extract domain from URL for display
 */
function getDomain(url: string): string {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return url;
    }
}

/**
 * Hook to register the retrieve tool with the AI system.
 */
export function useRetrieve(): void {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('Registering retrieve tool');

        // AI SDK v5: Use inputSchema instead of parameters
        registerTool({
            name: RETRIEVE_TOOL_NAME,
            description: TOOL_DESCRIPTION,
            inputSchema: retrieveSchema,
            execute: executeRetrieve,
        });

        // Register the UI renderer
        registerToolUI(
            RETRIEVE_TOOL_NAME,
            (state: ToolUIState) => <CompactToolRenderer state={state} />,
            {
                renderInput: (input: { url?: string }) => (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                        }}
                    >
                        <span style={{ opacity: 0.7 }}>🔗</span>
                        <span
                            style={{
                                color: 'var(--text-primary)',
                                opacity: 0.9,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '250px',
                            }}
                        >
                            {input.url ? getDomain(input.url) : 'URL'}
                        </span>
                    </div>
                ),
                renderOutput: (output: SearchResults) => (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {output.results && output.results.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ opacity: 0.7 }}>
                                    ✓ Retrieved content
                                </div>
                                <div
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
                                        {output?.results[0]?.title}
                                    </div>
                                    <div style={{ opacity: 0.5, fontSize: '10px' }}>
                                        {output?.results[0]?.content?.length.toLocaleString()} characters
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <span style={{ color: 'var(--error-color)' }}>
                                Failed to retrieve content
                            </span>
                        )}
                    </div>
                ),
            }
        );

        log.info('Retrieve tool registration complete');

        return () => {
            log.info('Cleaning up retrieve tool');
            unregisterToolUI(RETRIEVE_TOOL_NAME);
        };
    }, [registerToolUI, unregisterToolUI]);
}

export default useRetrieve;
