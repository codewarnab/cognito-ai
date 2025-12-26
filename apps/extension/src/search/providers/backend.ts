import { createLogger } from '~logger';
import { BaseSearchProvider } from './base';
import type { SearchResults, SearchDepth, SearchResultImage } from '../types';
import { WEB_SEARCH_API_URL } from '@/constants';

const log = createLogger('BackendSearch', 'SEARCH_PROVIDER');

/**
 * Backend search provider implementation.
 * Proxies search requests to the Vercel backend which uses a server-side Tavily API key.
 * This allows users to use web search without configuring their own API key.
 */
export class BackendSearchProvider extends BaseSearchProvider {
    constructor() {
        super('Backend');
    }

    async search(
        query: string,
        maxResults: number = 10,
        searchDepth: SearchDepth = 'basic',
        includeDomains: string[] = [],
        excludeDomains: string[] = []
    ): Promise<SearchResults> {
        log.info('🔍 Executing backend search', {
            query: query.substring(0, 50),
            maxResults,
            searchDepth,
        });

        try {
            const response = await fetch(WEB_SEARCH_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    max_results: maxResults,
                    search_depth: searchDepth,
                    include_domains: includeDomains,
                    exclude_domains: excludeDomains,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                log.error('Backend search API error', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText,
                });
                throw new Error(
                    `Backend search API error: ${response.status} ${response.statusText}`
                );
            }

            const data = await response.json();

            // Process images to ensure consistent format (always object with url and description)
            const processedImages: SearchResultImage[] = (data.images || []).map(
                (image: string | { url: string; description?: string }) => {
                    if (typeof image === 'string') {
                        return { url: this.sanitizeUrl(image), description: '' };
                    }
                    return {
                        url: this.sanitizeUrl(image.url),
                        description: image.description || '',
                    };
                }
            ).filter((img: { url: string; description: string }) => img.url && img.url.length > 0);

            // Process results to sanitize URLs
            const processedResults = (data.results || []).map(
                (result: { title: string; url: string; content: string }) => ({
                    title: result.title,
                    url: this.sanitizeUrl(result.url),
                    content: result.content,
                })
            );

            log.info('Backend search completed', {
                resultCount: processedResults.length,
                imageCount: processedImages.length,
            });

            return {
                results: processedResults,
                images: processedImages,
                query: data.query || query,
                number_of_results: processedResults.length,
            };
        } catch (error) {
            log.error('Backend search failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return this.createEmptyResult(query);
        }
    }
}
