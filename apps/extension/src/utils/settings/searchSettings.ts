import { createLogger } from '~logger';
import type { SearchProviderType, SearchDepth } from '@/search/types';

const log = createLogger('SearchSettings', 'SETTINGS');

export const SEARCH_SETTINGS_STORAGE_KEY = 'searchSettings';
export const SEARCH_API_KEYS_STORAGE_KEY = 'searchApiKeys';

/** Search settings stored in Chrome storage */
export interface SearchSettings {
    /** Whether web search is enabled */
    enabled: boolean;
    /** Default search provider */
    defaultProvider: SearchProviderType;
    /** Default search depth */
    defaultSearchDepth: SearchDepth;
    /** Maximum results to return */
    maxResults: number;
    /** Whether to include images in results */
    includeImages: boolean;
}

/** API keys for search providers (stored separately for security) */
export interface SearchApiKeys {
    tavily?: string;
}

/** Default search settings */
export const DEFAULT_SEARCH_SETTINGS: SearchSettings = {
    enabled: false,
    defaultProvider: 'tavily',
    defaultSearchDepth: 'basic',
    maxResults: 10,
    includeImages: true,
};

/** Default API keys (empty) */
export const DEFAULT_SEARCH_API_KEYS: SearchApiKeys = {};

/**
 * Get current search settings from Chrome storage.
 */
export async function getSearchSettings(): Promise<SearchSettings> {
    try {
        const result = await chrome.storage.local.get(SEARCH_SETTINGS_STORAGE_KEY);
        return {
            ...DEFAULT_SEARCH_SETTINGS,
            ...(result[SEARCH_SETTINGS_STORAGE_KEY] || {}),
        };
    } catch (error) {
        log.error('Failed to get search settings', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return DEFAULT_SEARCH_SETTINGS;
    }
}

/**
 * Save search settings to Chrome storage.
 */
export async function saveSearchSettings(settings: SearchSettings): Promise<void> {
    try {
        await chrome.storage.local.set({ [SEARCH_SETTINGS_STORAGE_KEY]: settings });
        log.info('Search settings saved');
    } catch (error) {
        log.error('Failed to save search settings', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

/**
 * Get search API keys from Chrome storage.
 */
export async function getSearchApiKeys(): Promise<SearchApiKeys> {
    try {
        const result = await chrome.storage.local.get(SEARCH_API_KEYS_STORAGE_KEY);
        return {
            ...DEFAULT_SEARCH_API_KEYS,
            ...(result[SEARCH_API_KEYS_STORAGE_KEY] || {}),
        };
    } catch (error) {
        log.error('Failed to get search API keys', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return DEFAULT_SEARCH_API_KEYS;
    }
}

/**
 * Save search API keys to Chrome storage.
 */
export async function saveSearchApiKeys(keys: SearchApiKeys): Promise<void> {
    try {
        await chrome.storage.local.set({ [SEARCH_API_KEYS_STORAGE_KEY]: keys });
        log.info('Search API keys saved');
    } catch (error) {
        log.error('Failed to save search API keys', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

/**
 * Check if web search is enabled.
 */
export async function isSearchEnabled(): Promise<boolean> {
    const settings = await getSearchSettings();
    return settings.enabled;
}

/**
 * Get API key for a specific provider.
 */
export async function getApiKeyForProvider(
    provider: SearchProviderType
): Promise<string | undefined> {
    const keys = await getSearchApiKeys();
    switch (provider) {
        case 'tavily':
            return keys.tavily;
        default:
            return undefined;
    }
}

/**
 * Check if a provider has a valid API key configured.
 */
export async function hasApiKeyForProvider(
    provider: SearchProviderType
): Promise<boolean> {
    const key = await getApiKeyForProvider(provider);
    return Boolean(key && key.trim().length > 0);
}
