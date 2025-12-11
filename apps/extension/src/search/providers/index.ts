import { createLogger } from '~logger';
import type { SearchProvider } from './base';
import { TavilySearchProvider } from './tavily';
import type { SearchProviderType } from '../types';

const log = createLogger('SearchProviderFactory', 'SEARCH');

export type { SearchProvider };
export { TavilySearchProvider };

/**
 * Factory function to create a search provider instance.
 *
 * @param type - The type of search provider to create
 * @param apiKey - The API key for the provider
 * @returns A configured SearchProvider instance
 * @throws Error if the provider type is not supported or API key is missing
 */
export function createSearchProvider(
    type: SearchProviderType,
    apiKey: string
): SearchProvider {
    log.debug('Creating search provider', { type });

    switch (type) {
        case 'tavily':
            return new TavilySearchProvider(apiKey);
        default:
            log.warn('Unknown provider type, falling back to Tavily', { type });
            return new TavilySearchProvider(apiKey);
    }
}
