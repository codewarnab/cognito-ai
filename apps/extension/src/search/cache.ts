import { createLogger } from '~logger';
import type { SearchResults } from './types';
import { LRUCache } from '~/utils/cache/LRUCache';

const log = createLogger('SearchCache', 'SEARCH_RESULTS');

/** Cache entry with metadata */
interface CacheEntry {
    results: SearchResults;
    provider: string;
    depth: string;
}

/** Default TTL: 1 hour in milliseconds */
const DEFAULT_TTL_MS = 60 * 60 * 1000;

/** Maximum cache entries */
const MAX_CACHE_ENTRIES = 50;

/**
 * LRU Cache instance for search results
 * - O(1) get, set, and eviction
 * - Automatic TTL expiration
 */
const searchCache = new LRUCache<string, CacheEntry>({
    maxSize: MAX_CACHE_ENTRIES,
    ttlMs: DEFAULT_TTL_MS,
    onEvict: (key) => {
        log.debug('Search cache entry evicted', { key });
    },
});

/**
 * Creates a cache key from search parameters.
 */
function createCacheKey(query: string, provider: string, depth: string): string {
    return `${query.toLowerCase().trim()}:${provider}:${depth}`;
}

/**
 * Gets cached search results if valid.
 * 
 * Time complexity: O(1)
 */
export async function getCachedResults(
    query: string,
    provider: string,
    depth: string,
    _ttlMs: number = DEFAULT_TTL_MS // TTL is now handled by LRUCache
): Promise<SearchResults | null> {
    try {
        const key = createCacheKey(query, provider, depth);
        const entry = searchCache.get(key);

        if (!entry) {
            return null;
        }

        log.debug('Cache hit', { key });
        return entry.results;
    } catch (error) {
        log.warn('Failed to read cache', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return null;
    }
}


/**
 * Stores search results in cache.
 * 
 * Time complexity: O(1) - LRU eviction is O(1)
 */
export async function setCachedResults(
    query: string,
    provider: string,
    depth: string,
    results: SearchResults
): Promise<void> {
    try {
        const key = createCacheKey(query, provider, depth);

        searchCache.set(key, {
            results,
            provider,
            depth,
        });

        log.debug('Cached search results', { key, resultCount: results.results.length });
    } catch (error) {
        log.warn('Failed to cache results', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Clears all cached search results.
 */
export async function clearSearchCache(): Promise<void> {
    try {
        searchCache.clear();
        log.info('Search cache cleared');
    } catch (error) {
        log.warn('Failed to clear cache', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Gets cache statistics.
 */
export async function getCacheStats(): Promise<{
    entryCount: number;
    totalSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
}> {
    try {
        const stats = searchCache.getStats();

        return {
            entryCount: stats.size,
            totalSize: 0, // Size estimation removed for simplicity
            oldestEntry: null, // LRU doesn't track timestamps externally
            newestEntry: null,
        };
    } catch (error) {
        log.warn('Failed to get cache stats', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return { entryCount: 0, totalSize: 0, oldestEntry: null, newestEntry: null };
    }
}

