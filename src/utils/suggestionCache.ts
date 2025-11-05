/**
 * Suggestion Cache Manager
 * Manages in-memory caching of suggestions per URL with 5-minute expiration
 */

import { createLogger } from '../logger';
import type { Suggestion } from '../ai/suggestions';

const log = createLogger('SuggestionCache');

// Cache duration: 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000;

interface CachedSuggestion {
    url: string;
    suggestions: Suggestion[];
    timestamp: number;
}

class SuggestionCache {
    private cache: Map<string, CachedSuggestion>;

    constructor() {
        this.cache = new Map();
    }

    /**
     * Get cached suggestions for a URL if still valid
     */
    getSuggestions(url: string): Suggestion[] | null {
        const cached = this.cache.get(url);

        if (!cached) {
            log.debug('Cache miss for:', url);
            return null;
        }

        if (this.isExpired(cached.timestamp)) {
            log.debug('Cache expired for:', url);
            this.cache.delete(url);
            return null;
        }

        log.debug('Cache hit for:', url);
        return cached.suggestions;
    }

    /**
     * Store suggestions for a URL with current timestamp
     */
    setSuggestions(url: string, suggestions: Suggestion[]): void {
        const cached: CachedSuggestion = {
            url,
            suggestions,
            timestamp: Date.now(),
        };

        this.cache.set(url, cached);
        log.debug('Cached suggestions for:', url);
    }

    /**
     * Clear all cached suggestions
     */
    clearCache(): void {
        this.cache.clear();
        log.info('Cache cleared');
    }

    /**
     * Check if a timestamp is expired (older than 5 minutes)
     */
    private isExpired(timestamp: number): boolean {
        return Date.now() - timestamp > CACHE_DURATION_MS;
    }

    /**
     * Get cache size (for debugging)
     */
    getSize(): number {
        return this.cache.size;
    }

    /**
     * Remove expired entries (periodic cleanup)
     */
    cleanExpired(): void {
        const toDelete: string[] = [];

        for (const [url, cached] of this.cache.entries()) {
            if (this.isExpired(cached.timestamp)) {
                toDelete.push(url);
            }
        }

        toDelete.forEach(url => this.cache.delete(url));

        if (toDelete.length > 0) {
            log.debug(`Cleaned ${toDelete.length} expired entries`);
        }
    }
}

// Export singleton instance
export const suggestionCache = new SuggestionCache();

// Periodic cleanup every 10 minutes
setInterval(() => {
    suggestionCache.cleanExpired();
}, 10 * 60 * 1000);
