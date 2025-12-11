import { createLogger } from '~logger';
import { BaseSearchProvider } from './base';
import type { SearchResults, SearchDepth, SearchResultImage } from '../types';

const log = createLogger('TavilySearch', 'SEARCH');

/** Tavily API endpoint */
const TAVILY_API_URL = 'https://api.tavily.com/search';

/** Tavily API response types */
interface TavilyResult {
    title: string;
    url: string;
    content: string;
    score?: number;
}

interface TavilyImageResult {
    url: string;
    description?: string;
}

interface TavilyResponse {
    query: string;
    results: TavilyResult[];
    images?: TavilyImageResult[] | string[];
    answer?: string;
    response_time?: number;
}

/**
 * Tavily search provider implementation.
 * Tavily is an AI-optimized search API that provides high-quality results.
 *
 * API Documentation: https://docs.tavily.com/docs/rest-api/api-reference
 *
 * Features:
 * - Basic and advanced search depths
 * - Image results with descriptions
 * - Domain filtering (include/exclude)
 * - AI-generated answers (optional)
 */
export class TavilySearchProvider extends BaseSearchProvider {
    private apiKey: string;

    constructor(apiKey: string) {
        super('Tavily');
        this.apiKey = apiKey;
    }

    async search(
        query: string,
        maxResults: number = 10,
        searchDepth: SearchDepth = 'basic',
        includeDomains: string[] = [],
        excludeDomains: string[] = []
    ): Promise<SearchResults> {
        this.validateApiKey(this.apiKey);

        // Tavily requires minimum 5 characters in query
        const paddedQuery =
            query.length < 5 ? query + ' '.repeat(5 - query.length) : query;

        log.info('🔍 Executing Tavily search', {
            query: paddedQuery.substring(0, 50),
            maxResults,
            searchDepth,
            searchDepthType: typeof searchDepth,
        });
        
        log.info('🔍 Tavily request body', {
            search_depth: searchDepth,
            max_results: Math.max(maxResults, 5),
            include_images: true,
        });

        try {
            const response = await fetch(TAVILY_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    api_key: this.apiKey,
                    query: paddedQuery,
                    max_results: Math.max(maxResults, 5), // Tavily minimum is 5
                    search_depth: searchDepth,
                    include_images: true,
                    include_image_descriptions: true,
                    include_answers: false, // We let the AI synthesize answers
                    include_domains:
                        includeDomains.length > 0 ? includeDomains : undefined,
                    exclude_domains:
                        excludeDomains.length > 0 ? excludeDomains : undefined,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                log.error('Tavily API error', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText,
                });
                throw new Error(
                    `Tavily API error: ${response.status} ${response.statusText}`
                );
            }

            const data: TavilyResponse = await response.json();

            // Process images - handle both string[] and object[] formats
            const processedImages: SearchResultImage[] = this.processImages(
                data.images
            );

            // Process results
            const processedResults = data.results.map((result) => ({
                title: result.title,
                url: this.sanitizeUrl(result.url),
                content: result.content,
            }));

            log.info('Tavily search completed', {
                resultCount: processedResults.length,
                imageCount: processedImages.length,
            });

            return {
                results: processedResults,
                images: processedImages,
                query: data.query,
                number_of_results: processedResults.length,
            };
        } catch (error) {
            log.error('Tavily search failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return this.createEmptyResult(query);
        }
    }

    /**
     * Process images from Tavily response.
     * Tavily can return images as strings or objects with descriptions.
     */
    private processImages(
        images?: TavilyImageResult[] | string[]
    ): SearchResultImage[] {
        if (!images || images.length === 0) {
            return [];
        }

        return images
            .map((image) => {
                if (typeof image === 'string') {
                    return { url: this.sanitizeUrl(image), description: '' };
                }
                return {
                    url: this.sanitizeUrl(image.url),
                    description: image.description || '',
                };
            })
            .filter((img) => img.url && img.url.length > 0);
    }
}
