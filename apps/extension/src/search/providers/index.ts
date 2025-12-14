import { createLogger } from '~logger';
import type { SearchProvider } from './base';
import { TavilySearchProvider } from './tavily';
import { BackendSearchProvider } from './backend';
import type { SearchProviderType } from '../types';
import { WEB_SEARCH_SELF_API_KEY_HIDDEN } from '@/constants';

const log = createLogger('SearchProviderFactory', 'SEARCH');

export type { SearchProvider };
export { TavilySearchProvider, BackendSearchProvider };

/**
 * Factory function to create a search provider instance.
 * 
 * When WEB_SEARCH_SELF_API_KEY_HIDDEN is enabled, returns a BackendSearchProvider
 * that proxies requests through the Vercel backend with a server-side API key.
 * Otherwise, returns a TavilySearchProvider using the user's API key.
 *
 * @param type - The type of search provider to create
 * @param apiKey - The API key for the provider (ignored when using backend)
 * @returns A configured SearchProvider instance
 * @throws Error if the provider type is not supported or API key is missing (when not using backend)
 */
export function createSearchProvider(
    type: SearchProviderType,
    apiKey: string
): SearchProvider {
    // If using self-hosted API key, always use the backend provider
    if (WEB_SEARCH_SELF_API_KEY_HIDDEN) {
        log.debug('Using backend search provider (self-hosted API key mode)');
        return new BackendSearchProvider();
    }

    log.debug('Creating search provider', { type });

    switch (type) {
        case 'tavily':
            return new TavilySearchProvider(apiKey);
        default:
            log.warn('Unknown provider type, falling back to Tavily', { type });
            return new TavilySearchProvider(apiKey);
    }
}

