import { createLogger } from '~logger';
import type { SearchResults } from './types';

const log = createLogger('SearchCache', 'SEARCH');

/** Cache entry with timestamp */
interface CacheEntry {
    results: SearchResults;
    timestamp: number;
    provider: string;
    depth: string;
}

/** Cache storage key */
const CACHE_KEY = 'searchResultsCache';

/** Default TTL: 1 hour in milliseconds */
const DEFAULT_TTL_MS = 60 * 60 * 1000;

/** Maximum cache entries */
const MAX_CACHE_ENTRIES = 50;

/**
 * Creates a cache key from search parameters.
 */
function createCacheKey(query: string, provider: string, depth: string): string {
    return `${query.toLowerCase().trim()}:${provider}:${depth}`;
}

/**
 * Gets cached search results if valid.
 */
export async function getCachedResults(
    query: string,
    provider: string,
    depth: string,
    ttlMs: number = DEFAULT_TTL_MS
): Promise<SearchResults | null> {
    try {
        const key = createCacheKey(query, provider, depth);
        const result = await chrome.storage.local.get(CACHE_KEY);
        const cache: Record<string, CacheEntry> = result[CACHE_KEY] || {};

        const entry = cache[key];
        if (!entry) {
            return null;
        }

        // Check if expired
        const age = Date.now() - entry.timestamp;
        if (age > ttlMs) {
            log.debug('Cache entry expired', { key, age: Math.floor(age / 1000) });
            return null;
        }

        log.debug('Cache hit', { key, age: Math.floor(age / 1000) });
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
 */
export async function setCachedResults(
    query: string,
    provider: string,
    depth: string,
    results: SearchResults
): Promise<void> {
    try {
        const key = createCacheKey(query, provider, depth);
        const storageResult = await chrome.storage.local.get(CACHE_KEY);
        const cache: Record<string, CacheEntry> = storageResult[CACHE_KEY] || {};

        // Add new entry
        cache[key] = {
            results,
            timestamp: Date.now(),
            provider,
            depth,
        };

        // Prune old entries if over limit
        const entries = Object.entries(cache);
        if (entries.length > MAX_CACHE_ENTRIES) {
            // Sort by timestamp, remove oldest
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
            toRemove.forEach(([k]) => delete cache[k]);
            log.debug('Pruned cache entries', { removed: toRemove.length });
        }

        await chrome.storage.local.set({ [CACHE_KEY]: cache });
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
        await chrome.storage.local.remove(CACHE_KEY);
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
        const result = await chrome.storage.local.get(CACHE_KEY);
        const cache: Record<string, CacheEntry> = result[CACHE_KEY] || {};
        const entries = Object.values(cache);

        if (entries.length === 0) {
            return { entryCount: 0, totalSize: 0, oldestEntry: null, newestEntry: null };
        }

        const timestamps = entries.map((e) => e.timestamp);
        const cacheString = JSON.stringify(cache);

        return {
            entryCount: entries.length,
            totalSize: new Blob([cacheString]).size,
            oldestEntry: Math.min(...timestamps),
            newestEntry: Math.max(...timestamps),
        };
    } catch (error) {
        log.warn('Failed to get cache stats', { 
            error: error instanceof Error ? error.message : 'Unknown error' 
        });
        return { entryCount: 0, totalSize: 0, oldestEntry: null, newestEntry: null };
    }
}
