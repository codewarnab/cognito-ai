import { createLogger } from '~logger';
import type { SearchResults, SearchDepth } from '../types';

const log = createLogger('SearchProvider', 'SEARCH');

/**
 * Interface that all search providers must implement.
 */
export interface SearchProvider {
    search(
        query: string,
        maxResults: number,
        searchDepth: SearchDepth,
        includeDomains: string[],
        excludeDomains: string[]
    ): Promise<SearchResults>;
}

/**
 * Abstract base class for search providers.
 * Provides common validation and error handling utilities.
 */
export abstract class BaseSearchProvider implements SearchProvider {
    protected providerName: string;

    constructor(providerName: string) {
        this.providerName = providerName;
    }

    abstract search(
        query: string,
        maxResults: number,
        searchDepth: SearchDepth,
        includeDomains: string[],
        excludeDomains: string[]
    ): Promise<SearchResults>;

    /**
     * Validates that an API key is present and non-empty.
     * @throws Error if API key is missing
     */
    protected validateApiKey(key: string | undefined): asserts key is string {
        if (!key || key.trim() === '') {
            const error = `${this.providerName} API key is not configured. Please add it in Settings > Web Search.`;
            log.error(error);
            throw new Error(error);
        }
    }

    /**
     * Sanitizes a URL by removing tracking parameters and normalizing format.
     */
    protected sanitizeUrl(url: string): string {
        try {
            const parsed = new URL(url);
            // Remove common tracking parameters
            const trackingParams = [
                'utm_source',
                'utm_medium',
                'utm_campaign',
                'utm_content',
                'utm_term',
                'ref',
                'fbclid',
                'gclid',
            ];
            trackingParams.forEach((param) => parsed.searchParams.delete(param));
            return parsed.toString();
        } catch {
            return url;
        }
    }

    /**
     * Creates an empty search result for error cases.
     */
    protected createEmptyResult(query: string): SearchResults {
        return {
            results: [],
            query,
            images: [],
            number_of_results: 0,
        };
    }
}
