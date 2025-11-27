# Multi-Phase Implementation Plan: Web Search Integration for Cognito AI

## Overview

Integrate web search capabilities into the Cognito Chrome Extension sidepanel, adding a search toggle in the chat input composer beside the tools icon, with controllable search depth and compact search result display optimized for the narrow sidepanel width.

**Design Principles for Chrome Sidepanel:**
- Minimal, compact UI - sidepanel is ~400px wide
- No carousels or complex dialogs - use simple grids and lists
- Favor vertical layouts over horizontal
- Collapsible sections to save space
- Small icons (14-16px), compact spacing (4-8px gaps)

---

## Phase 1: Search Infrastructure Setup

### 1.1 Search Provider Architecture
**Goal:** Create a flexible search provider system for web search APIs

**Directory Structure:**
```
src/search/
├── providers/
│   ├── base.ts           # BaseSearchProvider abstract class
│   ├── tavily.ts         # Tavily search provider (primary)
│   └── index.ts          # Provider factory
├── types.ts              # SearchResults, SearchResultItem types
├── schema.ts             # Zod schemas for search parameters
└── index.ts              # Main exports
```

---

#### File: `src/search/types.ts`

```typescript
/**
 * Search result types for web search integration.
 * These types define the structure of search results returned by providers.
 */

/** Depth of search - basic is faster, advanced is more thorough */
export type SearchDepth = 'basic' | 'advanced';

/** Individual search result item */
export interface SearchResultItem {
    /** Title of the search result */
    title: string;
    /** URL of the search result */
    url: string;
    /** Content snippet/description from the result */
    content: string;
}

/**
 * Search result image - can be a simple URL string or an object with description.
 * Tavily returns objects when include_image_descriptions is true.
 */
export type SearchResultImage =
    | string
    | {
          url: string;
          description: string;
      };

/** Complete search results returned by providers */
export interface SearchResults {
    /** Array of image results */
    images: SearchResultImage[];
    /** Array of text/link results */
    results: SearchResultItem[];
    /** Total number of results found (optional) */
    number_of_results?: number;
    /** Original query string */
    query: string;
}

/** Search provider types supported by the extension */
export type SearchProviderType = 'tavily';

/** Default search provider */
export const DEFAULT_SEARCH_PROVIDER: SearchProviderType = 'tavily';
```

---

#### File: `src/search/schema.ts`

```typescript
import { z } from 'zod';

/**
 * Zod schema for web search tool parameters.
 * Used by the AI to understand how to call the search tool.
 */
export const searchSchema = z.object({
    query: z
        .string()
        .min(1)
        .describe('The search query to look up on the web'),
    max_results: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(10)
        .describe('Maximum number of results to return (1-20, default: 10)'),
    search_depth: z
        .enum(['basic', 'advanced'])
        .optional()
        .default('basic')
        .describe(
            'Search depth: "basic" for quick results, "advanced" for more thorough search'
        ),
    include_domains: z
        .array(z.string())
        .optional()
        .default([])
        .describe(
            'Optional list of domains to include in search (e.g., ["reddit.com", "stackoverflow.com"])'
        ),
    exclude_domains: z
        .array(z.string())
        .optional()
        .default([])
        .describe(
            'Optional list of domains to exclude from search (e.g., ["pinterest.com"])'
        ),
});

/** Type inferred from the search schema */
export type SearchParams = z.infer<typeof searchSchema>;

/**
 * Zod schema for URL content retrieval tool parameters.
 */
export const retrieveSchema = z.object({
    url: z
        .string()
        .url()
        .describe('The URL to retrieve and extract content from'),
});

/** Type inferred from the retrieve schema */
export type RetrieveParams = z.infer<typeof retrieveSchema>;
```

---

#### File: `src/search/providers/base.ts`

```typescript
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
            const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'fbclid', 'gclid'];
            trackingParams.forEach(param => parsed.searchParams.delete(param));
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
```

---

#### File: `src/search/providers/tavily.ts`

```typescript
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
        const paddedQuery = query.length < 5 
            ? query + ' '.repeat(5 - query.length) 
            : query;

        log.info('Executing Tavily search', { 
            query: paddedQuery.substring(0, 50), 
            maxResults, 
            searchDepth 
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
                    include_domains: includeDomains.length > 0 ? includeDomains : undefined,
                    exclude_domains: excludeDomains.length > 0 ? excludeDomains : undefined,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                log.error('Tavily API error', { 
                    status: response.status, 
                    statusText: response.statusText,
                    error: errorText 
                });
                throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
            }

            const data: TavilyResponse = await response.json();

            // Process images - handle both string[] and object[] formats
            const processedImages: SearchResultImage[] = this.processImages(data.images);

            // Process results
            const processedResults = data.results.map(result => ({
                title: result.title,
                url: this.sanitizeUrl(result.url),
                content: result.content,
            }));

            log.info('Tavily search completed', { 
                resultCount: processedResults.length,
                imageCount: processedImages.length 
            });

            return {
                results: processedResults,
                images: processedImages,
                query: data.query,
                number_of_results: processedResults.length,
            };
        } catch (error) {
            log.error('Tavily search failed', { error: error instanceof Error ? error.message : 'Unknown error' });
            return this.createEmptyResult(query);
        }
    }

    /**
     * Process images from Tavily response.
     * Tavily can return images as strings or objects with descriptions.
     */
    private processImages(images?: TavilyImageResult[] | string[]): SearchResultImage[] {
        if (!images || images.length === 0) {
            return [];
        }

        return images
            .map(image => {
                if (typeof image === 'string') {
                    return { url: this.sanitizeUrl(image), description: '' };
                }
                return {
                    url: this.sanitizeUrl(image.url),
                    description: image.description || '',
                };
            })
            .filter(img => img.url && img.url.length > 0);
    }
}
```

---

#### File: `src/search/providers/index.ts`

```typescript
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
```

---

#### File: `src/search/index.ts`

```typescript
// Types
export type {
    SearchResults,
    SearchResultItem,
    SearchResultImage,
    SearchDepth,
    SearchProviderType,
} from './types';
export { DEFAULT_SEARCH_PROVIDER } from './types';

// Schemas
export { searchSchema, retrieveSchema } from './schema';
export type { SearchParams, RetrieveParams } from './schema';

// Providers
export type { SearchProvider } from './providers';
export { createSearchProvider, TavilySearchProvider } from './providers';
```

---

### 1.2 Search Configuration Storage
**Goal:** Store search API keys and preferences using Chrome storage

---

#### File: `src/utils/settings/searchSettings.ts`

```typescript
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
    enabled: true,
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
        return { ...DEFAULT_SEARCH_SETTINGS, ...(result[SEARCH_SETTINGS_STORAGE_KEY] || {}) };
    } catch (error) {
        log.error('Failed to get search settings', { error: error instanceof Error ? error.message : 'Unknown error' });
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
        log.error('Failed to save search settings', { error: error instanceof Error ? error.message : 'Unknown error' });
        throw error;
    }
}

/**
 * Get search API keys from Chrome storage.
 */
export async function getSearchApiKeys(): Promise<SearchApiKeys> {
    try {
        const result = await chrome.storage.local.get(SEARCH_API_KEYS_STORAGE_KEY);
        return { ...DEFAULT_SEARCH_API_KEYS, ...(result[SEARCH_API_KEYS_STORAGE_KEY] || {}) };
    } catch (error) {
        log.error('Failed to get search API keys', { error: error instanceof Error ? error.message : 'Unknown error' });
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
        log.error('Failed to save search API keys', { error: error instanceof Error ? error.message : 'Unknown error' });
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
export async function getApiKeyForProvider(provider: SearchProviderType): Promise<string | undefined> {
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
export async function hasApiKeyForProvider(provider: SearchProviderType): Promise<boolean> {
    const key = await getApiKeyForProvider(provider);
    return Boolean(key && key.trim().length > 0);
}
```

---

#### Update: `src/utils/settings/index.ts`

Add export for search settings:
```typescript
// Add to existing exports
export * from './searchSettings';
```

---

## Phase 2: Search Tool Registration

### 2.1 Create Search Tool Hook
**Goal:** Register web search as an AI tool following the existing tool pattern

**Directory Structure:**
```
src/actions/search/
├── useWebSearch.tsx      # Main search tool hook
├── useRetrieve.tsx       # URL content retrieval tool
├── index.ts              # Exports
```

---

#### File: `src/actions/search/useWebSearch.tsx`

```typescript
import { useEffect } from 'react';
import { createLogger } from '~logger';
import { registerTool, registerToolUI } from '@/ai/tools/registryUtils';
import { searchSchema } from '@/search/schema';
import { createSearchProvider } from '@/search/providers';
import {
    getSearchSettings,
    getApiKeyForProvider,
} from '@/utils/settings/searchSettings';
import type { SearchResults } from '@/search/types';
import { SearchSection } from '@/components/features/chat/components/SearchSection';

const log = createLogger('WebSearchTool', 'TOOL');

/** Tool name constant */
export const WEB_SEARCH_TOOL_NAME = 'webSearch';

/**
 * Tool description following the USE/REQUIRES/BEHAVIOR/RETURNS format.
 * This helps the AI understand when and how to use the tool.
 */
const TOOL_DESCRIPTION = `Search the web for current information, news, facts, or any topic.

USE: When you need up-to-date information, recent news, facts you're uncertain about, or information that may have changed since your knowledge cutoff.

REQUIRES:
- query: The search query (required, minimum 1 character)
- max_results: Number of results to return (optional, 1-20, default 10)
- search_depth: "basic" for quick results or "advanced" for thorough search (optional, default "basic")
- include_domains: Array of domains to include (optional, e.g., ["reddit.com"])
- exclude_domains: Array of domains to exclude (optional, e.g., ["pinterest.com"])

BEHAVIOR:
1. Sends query to web search API
2. Returns results with titles, URLs, and content snippets
3. May include relevant images
4. Use "advanced" search_depth for complex queries or when basic search doesn't find good results

RETURNS: Object with:
- results: Array of {title, url, content} objects
- images: Array of image URLs with descriptions
- query: The original search query
- number_of_results: Total results found

IMPORTANT: Always cite sources in your response using [Source Title](url) format when using information from search results.`;

/**
 * Execute web search using configured provider.
 */
async function executeWebSearch(params: {
    query: string;
    max_results?: number;
    search_depth?: 'basic' | 'advanced';
    include_domains?: string[];
    exclude_domains?: string[];
}): Promise<SearchResults> {
    const settings = await getSearchSettings();
    const apiKey = await getApiKeyForProvider(settings.defaultProvider);

    if (!apiKey) {
        log.warn('No API key configured for search provider', { provider: settings.defaultProvider });
        return {
            results: [],
            images: [],
            query: params.query,
            number_of_results: 0,
        };
    }

    const provider = createSearchProvider(settings.defaultProvider, apiKey);

    const maxResults = params.max_results ?? settings.maxResults;
    const searchDepth = params.search_depth ?? settings.defaultSearchDepth;

    log.info('Executing web search', {
        query: params.query.substring(0, 50),
        maxResults,
        searchDepth,
        provider: settings.defaultProvider,
    });

    try {
        const results = await provider.search(
            params.query,
            maxResults,
            searchDepth,
            params.include_domains ?? [],
            params.exclude_domains ?? []
        );

        // Filter out images if disabled in settings
        if (!settings.includeImages) {
            results.images = [];
        }

        log.info('Web search completed', {
            resultCount: results.results.length,
            imageCount: results.images.length,
        });

        return results;
    } catch (error) {
        log.error('Web search failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return {
            results: [],
            images: [],
            query: params.query,
            number_of_results: 0,
        };
    }
}

/**
 * Hook to register the web search tool with the AI system.
 * Should be called once at app initialization.
 */
export function useWebSearch(): void {
    useEffect(() => {
        log.info('Registering web search tool');

        // Register the tool
        const unregisterTool = registerTool(WEB_SEARCH_TOOL_NAME, {
            description: TOOL_DESCRIPTION,
            parameters: searchSchema,
            execute: executeWebSearch,
        });

        // Register the UI renderer for search results
        const unregisterUI = registerToolUI(WEB_SEARCH_TOOL_NAME, (props) => (
            <SearchSection
                tool={props.toolInvocation}
                isOpen={props.isOpen}
                onOpenChange={props.onOpenChange}
            />
        ));

        return () => {
            log.info('Unregistering web search tool');
            unregisterTool();
            unregisterUI();
        };
    }, []);
}

export default useWebSearch;
```

---

#### File: `src/actions/search/useRetrieve.tsx`

```typescript
import { useEffect } from 'react';
import { createLogger } from '~logger';
import { registerTool, registerToolUI } from '@/ai/tools/registryUtils';
import { retrieveSchema } from '@/search/schema';
import type { SearchResults } from '@/search/types';
import { RetrieveSection } from '@/components/features/chat/components/RetrieveSection';

const log = createLogger('RetrieveTool', 'TOOL');

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

RETURNS: Object with:
- results: Array containing single {title, url, content} object
- query: Empty string (not a search)
- images: Empty array

NOTE: Use this for deep-diving into specific URLs found from web search. Do not use for general searches.`;

/**
 * Fetch content from URL using Jina Reader API.
 * Jina Reader is a free API that extracts clean content from web pages.
 */
async function fetchJinaReaderData(url: string): Promise<SearchResults | null> {
    try {
        log.info('Fetching URL content via Jina Reader', { url: url.substring(0, 100) });

        const response = await fetch(`${JINA_READER_URL}/${url}`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'X-With-Generated-Alt': 'true',
            },
        });

        if (!response.ok) {
            log.warn('Jina Reader returned non-OK status', { status: response.status });
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
 */
async function executeRetrieve(params: { url: string }): Promise<SearchResults | null> {
    log.info('Executing URL retrieve', { url: params.url.substring(0, 100) });

    const results = await fetchJinaReaderData(params.url);

    if (!results) {
        log.warn('Failed to retrieve URL content', { url: params.url });
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
 * Hook to register the retrieve tool with the AI system.
 * Should be called once at app initialization.
 */
export function useRetrieve(): void {
    useEffect(() => {
        log.info('Registering retrieve tool');

        // Register the tool
        const unregisterTool = registerTool(RETRIEVE_TOOL_NAME, {
            description: TOOL_DESCRIPTION,
            parameters: retrieveSchema,
            execute: executeRetrieve,
        });

        // Register the UI renderer
        const unregisterUI = registerToolUI(RETRIEVE_TOOL_NAME, (props) => (
            <RetrieveSection
                tool={props.toolInvocation}
                isOpen={props.isOpen}
                onOpenChange={props.onOpenChange}
            />
        ));

        return () => {
            log.info('Unregistering retrieve tool');
            unregisterTool();
            unregisterUI();
        };
    }, []);
}

export default useRetrieve;
```

---

#### File: `src/actions/search/index.ts`

```typescript
export { useWebSearch, WEB_SEARCH_TOOL_NAME } from './useWebSearch';
export { useRetrieve, RETRIEVE_TOOL_NAME } from './useRetrieve';
```

---

### 2.2 Search Mode State Management
**Goal:** Create a search mode toggle that persists user preference

---

#### File: `src/hooks/useSearchMode.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { createLogger } from '~logger';
import { getSearchSettings, saveSearchSettings, hasApiKeyForProvider } from '@/utils/settings/searchSettings';
import type { SearchDepth } from '@/search/types';

const log = createLogger('useSearchMode', 'HOOK');

/** Storage key for search mode state (separate from full settings for quick access) */
const SEARCH_MODE_KEY = 'searchModeEnabled';
const SEARCH_DEPTH_KEY = 'searchDepth';

export interface UseSearchModeResult {
    /** Whether search mode is enabled */
    isSearchMode: boolean;
    /** Toggle search mode on/off */
    toggleSearchMode: () => void;
    /** Set search mode directly */
    setSearchMode: (enabled: boolean) => void;
    /** Current search depth */
    searchDepth: SearchDepth;
    /** Set search depth */
    setSearchDepth: (depth: SearchDepth) => void;
    /** Whether a valid API key is configured */
    hasApiKey: boolean;
    /** Whether the hook is still loading initial state */
    isLoading: boolean;
}

/**
 * Hook to manage search mode state.
 * Persists state to Chrome storage and provides toggle functionality.
 */
export function useSearchMode(): UseSearchModeResult {
    const [isSearchMode, setIsSearchModeState] = useState(false);
    const [searchDepth, setSearchDepthState] = useState<SearchDepth>('basic');
    const [hasApiKey, setHasApiKey] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load initial state from storage
    useEffect(() => {
        const loadState = async () => {
            try {
                const settings = await getSearchSettings();
                
                // Check if API key is configured
                const keyConfigured = await hasApiKeyForProvider(settings.defaultProvider);
                setHasApiKey(keyConfigured);

                // Load from local storage for quick access (separate from full settings)
                const result = await chrome.storage.local.get([SEARCH_MODE_KEY, SEARCH_DEPTH_KEY]);
                
                // Default to enabled if API key is present, otherwise disabled
                const savedMode = result[SEARCH_MODE_KEY];
                setIsSearchModeState(savedMode !== undefined ? savedMode : (keyConfigured && settings.enabled));
                
                const savedDepth = result[SEARCH_DEPTH_KEY] as SearchDepth;
                setSearchDepthState(savedDepth || settings.defaultSearchDepth);
            } catch (error) {
                log.error('Failed to load search mode state', { 
                    error: error instanceof Error ? error.message : 'Unknown error' 
                });
            } finally {
                setIsLoading(false);
            }
        };
        loadState();
    }, []);

    // Persist search mode to storage
    const setSearchMode = useCallback(async (enabled: boolean) => {
        setIsSearchModeState(enabled);
        try {
            await chrome.storage.local.set({ [SEARCH_MODE_KEY]: enabled });
            log.debug('Search mode saved', { enabled });
        } catch (error) {
            log.error('Failed to save search mode', { 
                error: error instanceof Error ? error.message : 'Unknown error' 
            });
        }
    }, []);

    // Toggle search mode
    const toggleSearchMode = useCallback(() => {
        setSearchMode(!isSearchMode);
    }, [isSearchMode, setSearchMode]);

    // Persist search depth to storage
    const setSearchDepth = useCallback(async (depth: SearchDepth) => {
        setSearchDepthState(depth);
        try {
            await chrome.storage.local.set({ [SEARCH_DEPTH_KEY]: depth });
            log.debug('Search depth saved', { depth });
        } catch (error) {
            log.error('Failed to save search depth', { 
                error: error instanceof Error ? error.message : 'Unknown error' 
            });
        }
    }, []);

    return {
        isSearchMode,
        toggleSearchMode,
        setSearchMode,
        searchDepth,
        setSearchDepth,
        hasApiKey,
        isLoading,
    };
}

export default useSearchMode;
```

---

#### Update: `src/actions/registerAll.ts`

Add search tools to registration:
```typescript
// Add imports
import { useWebSearch } from '@/actions/search/useWebSearch';
import { useRetrieve } from '@/actions/search/useRetrieve';

// In the component or hook that registers all tools, add:
useWebSearch();
useRetrieve();
```

---

## Phase 3: Composer UI Components

### 3.1 Search Mode Toggle Component
**Goal:** Create a minimal toggle button for the composer (optimized for sidepanel)

---

#### File: `src/styles/features/search-mode-toggle.css`

```css
/* Search Mode Toggle Styles */
.search-mode-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 500;
    transition: all 150ms ease-in-out;
    border: 1px solid var(--border-color, #e5e7eb);
    cursor: pointer;
    background: transparent;
}

.search-mode-toggle:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--focus-ring-color, rgba(59, 130, 246, 0.5));
}

.search-mode-toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.search-mode-toggle--loading {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* Enabled state */
.search-mode-toggle--enabled {
    background-color: rgba(59, 130, 246, 0.15);
    color: var(--color-blue-600, #2563eb);
    border-color: rgba(59, 130, 246, 0.3);
}

.search-mode-toggle--enabled:hover {
    background-color: rgba(59, 130, 246, 0.25);
}

/* Disabled state (not pressed) */
.search-mode-toggle--disabled {
    background: transparent;
    color: var(--text-secondary, #6b7280);
    border-color: var(--border-color, #d1d5db);
}

.search-mode-toggle--disabled:hover:not(:disabled) {
    background-color: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #374151);
}

/* Icon */
.search-mode-toggle__icon {
    transition: color 150ms;
}

.search-mode-toggle--enabled .search-mode-toggle__icon {
    color: var(--color-blue-500, #3b82f6);
}

/* Label - hidden on small screens */
.search-mode-toggle__label {
    display: none;
}

@media (min-width: 640px) {
    .search-mode-toggle__label {
        display: inline;
    }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
    .search-mode-toggle--enabled {
        color: var(--color-blue-400, #60a5fa);
    }
    
    .search-mode-toggle--disabled {
        color: var(--text-secondary-dark, #9ca3af);
        border-color: var(--border-color-dark, #4b5563);
    }
    
    .search-mode-toggle--disabled:hover:not(:disabled) {
        background-color: var(--bg-hover-dark, #1f2937);
        color: var(--text-primary-dark, #d1d5db);
    }
    
    .search-mode-toggle--enabled .search-mode-toggle__icon {
        color: var(--color-blue-400, #60a5fa);
    }
}
```

---

#### File: `src/components/features/chat/components/SearchModeToggle.tsx`

```tsx
import React from 'react';
import { Globe } from 'lucide-react';
import { Tooltip } from '@/components/shared/Tooltip';
import '@/styles/features/search-mode-toggle.css';

export interface SearchModeToggleProps {
    /** Whether search mode is enabled */
    isEnabled: boolean;
    /** Callback when toggle is clicked */
    onToggle: () => void;
    /** Whether API key is configured */
    hasApiKey: boolean;
    /** Whether the component is in loading state */
    isLoading?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Minimal toggle button for enabling/disabling web search mode.
 * Designed for Chrome sidepanel - compact with clear visual feedback.
 */
export const SearchModeToggle: React.FC<SearchModeToggleProps> = ({
    isEnabled,
    onToggle,
    hasApiKey,
    isLoading = false,
    className,
}) => {
    const handleClick = () => {
        if (!isLoading && hasApiKey) {
            onToggle();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isLoading && hasApiKey) {
            e.preventDefault();
            onToggle();
        }
    };

    const tooltipContent = !hasApiKey
        ? 'Add API key in Settings to enable web search'
        : isEnabled
          ? 'Web search enabled - AI can search the internet'
          : 'Click to enable web search';

    // Build class list
    const classNames = [
        'search-mode-toggle',
        isLoading && 'search-mode-toggle--loading',
        isEnabled && hasApiKey && 'search-mode-toggle--enabled',
        !isEnabled && hasApiKey && 'search-mode-toggle--disabled',
        className
    ].filter(Boolean).join(' ');

    return (
        <Tooltip content={tooltipContent}>
            <button
                type="button"
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                disabled={isLoading || !hasApiKey}
                aria-label={isEnabled ? 'Disable web search' : 'Enable web search'}
                aria-pressed={isEnabled}
                className={classNames}
            >
                <Globe size={14} className="search-mode-toggle__icon" />
                <span className="search-mode-toggle__label">Search</span>
            </button>
        </Tooltip>
    );
};

export default SearchModeToggle;
```

---

### 3.2 Search Depth Selector
**Goal:** Compact dropdown for selecting search depth

---

#### File: `src/styles/features/search-depth-selector.css`

```css
/* Search Depth Selector Styles */
.search-depth-selector {
    position: relative;
}

.search-depth-selector__trigger {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-secondary, #6b7280);
    background: none;
    border: none;
    cursor: pointer;
    transition: background-color 150ms, color 150ms;
}

.search-depth-selector__trigger:hover:not(:disabled) {
    background-color: var(--bg-hover, #f3f4f6);
}

.search-depth-selector__trigger:focus {
    outline: none;
    box-shadow: 0 0 0 1px var(--focus-ring-color, rgba(107, 114, 128, 0.5));
}

.search-depth-selector__trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.search-depth-selector__chevron {
    transition: transform 150ms;
}

.search-depth-selector__chevron--open {
    transform: rotate(180deg);
}

/* Dropdown */
.search-depth-selector__dropdown {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: 4px;
    min-width: 140px;
    background-color: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 8px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    padding: 4px 0;
    z-index: 50;
}

.search-depth-selector__option {
    width: 100%;
    text-align: left;
    padding: 6px 12px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: none;
    border: none;
    cursor: pointer;
    transition: background-color 100ms;
}

.search-depth-selector__option:hover {
    background-color: var(--bg-hover, #f3f4f6);
}

.search-depth-selector__option--selected {
    background-color: var(--bg-selected, #f9fafb);
}

.search-depth-selector__option-icon {
    margin-top: 2px;
    color: var(--text-tertiary, #9ca3af);
}

.search-depth-selector__option-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary, #374151);
}

.search-depth-selector__option-description {
    font-size: 10px;
    color: var(--text-secondary, #6b7280);
}

/* Hide label on small screens */
.search-depth-selector__trigger-label {
    display: none;
}

@media (min-width: 640px) {
    .search-depth-selector__trigger-label {
        display: inline;
    }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
    .search-depth-selector__trigger {
        color: var(--text-secondary-dark, #9ca3af);
    }
    
    .search-depth-selector__trigger:hover:not(:disabled) {
        background-color: var(--bg-hover-dark, #1f2937);
    }
    
    .search-depth-selector__dropdown {
        background-color: var(--bg-primary-dark, #111827);
        border-color: var(--border-color-dark, #374151);
    }
    
    .search-depth-selector__option:hover {
        background-color: var(--bg-hover-dark, #1f2937);
    }
    
    .search-depth-selector__option--selected {
        background-color: var(--bg-selected-dark, #1f2937);
    }
    
    .search-depth-selector__option-label {
        color: var(--text-primary-dark, #e5e7eb);
    }
    
    .search-depth-selector__option-description {
        color: var(--text-secondary-dark, #9ca3af);
    }
}
```

---

#### File: `src/components/features/chat/components/SearchDepthSelector.tsx`

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Zap, Search } from 'lucide-react';
import type { SearchDepth } from '@/search/types';
import '@/styles/features/search-depth-selector.css';

export interface SearchDepthSelectorProps {
    /** Current search depth */
    value: SearchDepth;
    /** Callback when depth changes */
    onChange: (depth: SearchDepth) => void;
    /** Whether the selector is disabled */
    disabled?: boolean;
    /** Additional CSS classes */
    className?: string;
}

interface DepthOption {
    value: SearchDepth;
    label: string;
    description: string;
    icon: React.ReactNode;
}

const DEPTH_OPTIONS: DepthOption[] = [
    {
        value: 'basic',
        label: 'Basic',
        description: 'Quick search, faster results',
        icon: <Zap size={12} />,
    },
    {
        value: 'advanced',
        label: 'Advanced',
        description: 'Thorough search, more results',
        icon: <Search size={12} />,
    },
];

/**
 * Compact dropdown for selecting search depth.
 * Shows as a small pill that expands on click.
 */
export const SearchDepthSelector: React.FC<SearchDepthSelectorProps> = ({
    value,
    onChange,
    disabled = false,
    className,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const currentOption = DEPTH_OPTIONS.find(opt => opt.value === value) || DEPTH_OPTIONS[0];

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleSelect = (depth: SearchDepth) => {
        onChange(depth);
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
        }
    };

    const containerClasses = ['search-depth-selector', className].filter(Boolean).join(' ');
    const chevronClasses = ['search-depth-selector__chevron', isOpen && 'search-depth-selector__chevron--open'].filter(Boolean).join(' ');

    return (
        <div ref={containerRef} className={containerClasses}>
            {/* Trigger button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                aria-label={`Search depth: ${currentOption.label}`}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                className="search-depth-selector__trigger"
            >
                {currentOption.icon}
                <span className="search-depth-selector__trigger-label">{currentOption.label}</span>
                <ChevronDown size={10} className={chevronClasses} />
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <div role="listbox" className="search-depth-selector__dropdown">
                    {DEPTH_OPTIONS.map((option) => {
                        const optionClasses = [
                            'search-depth-selector__option',
                            option.value === value && 'search-depth-selector__option--selected'
                        ].filter(Boolean).join(' ');
                        
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="option"
                                aria-selected={option.value === value}
                                onClick={() => handleSelect(option.value)}
                                className={optionClasses}
                            >
                                <span className="search-depth-selector__option-icon">{option.icon}</span>
                                <div>
                                    <div className="search-depth-selector__option-label">
                                        {option.label}
                                    </div>
                                    <div className="search-depth-selector__option-description">
                                        {option.description}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SearchDepthSelector;
```

---

### 3.3 Composer Integration
**Goal:** Add search controls to the composer's left section

---

#### File: `src/styles/features/search-controls.css`

```css
/* Search Controls Styles */
.search-controls {
    display: flex;
    align-items: center;
    gap: 4px;
}

/* Search Mode Toggle Animation */
.search-toggle-enter {
    opacity: 0;
    transform: scale(0.95);
}

.search-toggle-enter-active {
    opacity: 1;
    transform: scale(1);
    transition: opacity 150ms ease-out, transform 150ms ease-out;
}

/* Search Depth Dropdown Animation */
.search-depth-dropdown-enter {
    opacity: 0;
    transform: translateY(4px);
}

.search-depth-dropdown-enter-active {
    opacity: 1;
    transform: translateY(0);
    transition: opacity 100ms ease-out, transform 100ms ease-out;
}

.search-depth-dropdown-exit {
    opacity: 1;
}

.search-depth-dropdown-exit-active {
    opacity: 0;
    transition: opacity 75ms ease-in;
}

/* Globe icon pulse when active */
@keyframes search-pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.7;
    }
}

.search-active-indicator {
    animation: search-pulse 2s ease-in-out infinite;
}
```

---

#### File: `src/components/features/chat/components/SearchControls.tsx`

```tsx
import React from 'react';
import { SearchModeToggle } from './SearchModeToggle';
import { SearchDepthSelector } from './SearchDepthSelector';
import { useSearchMode } from '@/hooks/useSearchMode';
import '@/styles/features/search-controls.css';

export interface SearchControlsProps {
    /** Additional CSS classes */
    className?: string;
}

/**
 * Combined search controls component for the composer.
 * Shows search toggle and depth selector in a compact horizontal layout.
 */
export const SearchControls: React.FC<SearchControlsProps> = ({ className }) => {
    const {
        isSearchMode,
        toggleSearchMode,
        searchDepth,
        setSearchDepth,
        hasApiKey,
        isLoading,
    } = useSearchMode();

    const classNames = ['search-controls', className].filter(Boolean).join(' ');

    return (
        <div className={classNames}>
            <SearchModeToggle
                isEnabled={isSearchMode}
                onToggle={toggleSearchMode}
                hasApiKey={hasApiKey}
                isLoading={isLoading}
            />
            {/* Only show depth selector when search is enabled */}
            {isSearchMode && hasApiKey && (
                <SearchDepthSelector
                    value={searchDepth}
                    onChange={setSearchDepth}
                    disabled={isLoading}
                />
            )}
        </div>
    );
};

export default SearchControls;
```

---

## Phase 4: Search Results Display Components

### 4.1 Search Section Component
**Goal:** Display search tool invocation and results in a collapsible container

**Design Notes for Chrome Sidepanel:**
- Collapsible to save vertical space
- Header shows query text and result count badge
- Loading skeleton during search
- Compact spacing optimized for ~400px width

---

#### File: `src/styles/features/search-section.css`

```css
/* Search Section Styles */
.search-section {
    border-radius: 8px;
    border: 1px solid var(--border-color, #e5e7eb);
    background-color: var(--bg-primary, #ffffff);
    overflow: hidden;
}

/* Header button */
.search-section__header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    transition: background-color 150ms;
}

.search-section__header:hover {
    background-color: var(--bg-hover, #f9fafb);
}

/* Icon container */
.search-section__icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(59, 130, 246, 0.1);
    color: var(--color-blue-600, #2563eb);
}

.search-section__icon--loading svg {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

/* Query text */
.search-section__query {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    color: var(--text-primary, #374151);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Result count badge */
.search-section__badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    font-size: 12px;
    font-weight: 500;
    background-color: rgba(34, 197, 94, 0.1);
    color: var(--color-green-700, #15803d);
    border-radius: 9999px;
}

/* Chevron */
.search-section__chevron {
    flex-shrink: 0;
    color: var(--text-tertiary, #9ca3af);
    transition: transform 200ms;
}

.search-section__chevron--open {
    transform: rotate(180deg);
}

/* Content */
.search-section__content {
    border-top: 1px solid var(--border-color, #e5e7eb);
}

.search-section__content-inner {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

/* Sources label */
.search-section__sources-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
    margin-bottom: 8px;
}

/* No results message */
.search-section__no-results {
    font-size: 14px;
    color: var(--text-secondary, #6b7280);
    text-align: center;
    padding: 16px 0;
}

/* Loading skeleton */
.search-section__skeleton {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.search-section__skeleton-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
}

.search-section__skeleton-item {
    height: 64px;
    border-radius: 8px;
    background-color: var(--bg-skeleton, #f3f4f6);
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
    .search-section {
        border-color: var(--border-color-dark, #374151);
        background-color: var(--bg-primary-dark, #111827);
    }
    
    .search-section__header:hover {
        background-color: var(--bg-hover-dark, #1f2937);
    }
    
    .search-section__icon {
        background-color: rgba(59, 130, 246, 0.2);
        color: var(--color-blue-400, #60a5fa);
    }
    
    .search-section__query {
        color: var(--text-primary-dark, #e5e7eb);
    }
    
    .search-section__badge {
        background-color: rgba(34, 197, 94, 0.2);
        color: var(--color-green-400, #4ade80);
    }
    
    .search-section__content {
        border-color: var(--border-color-dark, #374151);
    }
    
    .search-section__sources-label {
        color: var(--text-secondary-dark, #9ca3af);
    }
    
    .search-section__no-results {
        color: var(--text-secondary-dark, #9ca3af);
    }
    
    .search-section__skeleton-item {
        background-color: var(--bg-skeleton-dark, #1f2937);
    }
}
```

---

#### File: `src/components/features/chat/components/SearchSection.tsx`

```tsx
import React from 'react';
import { ChevronDown, Search, Check, Loader2 } from 'lucide-react';
import type { ToolInvocation } from 'ai';
import type { SearchResults as SearchResultsType } from '@/search/types';
import { SearchResults } from './SearchResults';
import { SearchResultsImageSection } from './SearchResultsImageSection';
import '@/styles/features/search-section.css';

export interface SearchSectionProps {
    /** Tool invocation data from AI SDK */
    tool: ToolInvocation;
    /** Whether the section is expanded */
    isOpen: boolean;
    /** Callback when open state changes */
    onOpenChange: (open: boolean) => void;
}

/**
 * Collapsible section displaying search results.
 * Shows query, result count, and expandable results grid.
 */
export const SearchSection: React.FC<SearchSectionProps> = ({
    tool,
    isOpen,
    onOpenChange,
}) => {
    const isLoading = tool.state === 'call';
    const searchResults: SearchResultsType | undefined = 
        tool.state === 'result' ? tool.result : undefined;
    
    // Extract query from tool args
    const query = (tool.args as { query?: string })?.query || '';
    const includeDomains = (tool.args as { include_domains?: string[] })?.include_domains;
    
    // Format header text
    const headerText = includeDomains?.length 
        ? `${query} [${includeDomains.join(', ')}]`
        : query;
    
    const resultCount = searchResults?.results?.length || 0;
    const hasImages = (searchResults?.images?.length || 0) > 0;

    const iconClasses = ['search-section__icon', isLoading && 'search-section__icon--loading'].filter(Boolean).join(' ');
    const chevronClasses = ['search-section__chevron', isOpen && 'search-section__chevron--open'].filter(Boolean).join(' ');

    return (
        <div className="search-section">
            {/* Header - always visible */}
            <button
                type="button"
                onClick={() => onOpenChange(!isOpen)}
                aria-expanded={isOpen}
                aria-label={`Search results for ${query}`}
                className="search-section__header"
            >
                {/* Icon */}
                <div className={iconClasses}>
                    {isLoading ? (
                        <Loader2 size={14} />
                    ) : (
                        <Search size={14} />
                    )}
                </div>

                {/* Query text */}
                <span className="search-section__query">
                    {headerText || 'Searching...'}
                </span>

                {/* Result count badge */}
                {!isLoading && resultCount > 0 && (
                    <span className="search-section__badge">
                        <Check size={10} />
                        {resultCount} results
                    </span>
                )}

                {/* Expand/collapse chevron */}
                <ChevronDown size={16} className={chevronClasses} />
            </button>

            {/* Collapsible content */}
            {isOpen && (
                <div className="search-section__content">
                    {isLoading ? (
                        <SearchSkeleton />
                    ) : searchResults ? (
                        <div className="search-section__content-inner">
                            {/* Images section */}
                            {hasImages && (
                                <SearchResultsImageSection
                                    images={searchResults.images}
                                    query={query}
                                />
                            )}
                            
                            {/* Results list */}
                            {resultCount > 0 && (
                                <div>
                                    <div className="search-section__sources-label">
                                        Sources
                                    </div>
                                    <SearchResults results={searchResults.results} />
                                </div>
                            )}
                            
                            {/* No results message */}
                            {resultCount === 0 && !hasImages && (
                                <div className="search-section__no-results">
                                    No results found for "{query}"
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
};

/**
 * Loading skeleton for search results.
 */
const SearchSkeleton: React.FC = () => (
    <div className="search-section__skeleton">
        <div className="search-section__skeleton-grid">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="search-section__skeleton-item" />
            ))}
        </div>
    </div>
);

export default SearchSection;
```

---

### 4.2 Search Results Grid/List
**Goal:** Display individual search results in compact grid or list format

---

#### File: `src/styles/features/search-results.css`

```css
/* Search Results Styles */
.search-results {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* Grid layout */
.search-results__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
}

/* List layout */
.search-results__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* Result card base */
.search-result-card {
    display: block;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid var(--border-color, #e5e7eb);
    text-decoration: none;
    transition: background-color 150ms;
}

.search-result-card:hover {
    background-color: var(--bg-hover, #f9fafb);
}

/* Grid card */
.search-result-card--grid .search-result-card__title {
    font-size: 12px;
    color: var(--text-primary, #374151);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 32px;
}

.search-result-card--grid .search-result-card__meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
}

.search-result-card--grid .search-result-card__favicon {
    flex-shrink: 0;
    width: 12px;
    height: 12px;
    border-radius: 2px;
}

.search-result-card--grid .search-result-card__domain {
    font-size: 10px;
    color: var(--text-secondary, #6b7280);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* List card */
.search-result-card--list {
    display: flex;
    align-items: flex-start;
    gap: 8px;
}

.search-result-card--list .search-result-card__favicon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    margin-top: 2px;
    border-radius: 2px;
}

.search-result-card--list .search-result-card__content {
    flex: 1;
    min-width: 0;
}

.search-result-card--list .search-result-card__title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary, #111827);
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.search-result-card--list .search-result-card__snippet {
    font-size: 12px;
    color: var(--text-secondary, #4b5563);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-top: 2px;
}

.search-result-card--list .search-result-card__meta {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    font-size: 10px;
    color: var(--text-tertiary, #9ca3af);
}

.search-result-card__external-link {
    flex-shrink: 0;
    opacity: 0;
    color: var(--text-tertiary, #9ca3af);
    margin-top: 2px;
    transition: opacity 150ms;
}

.search-result-card:hover .search-result-card__external-link {
    opacity: 1;
}

/* View more button */
.search-results__view-more {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid var(--border-color, #e5e7eb);
    background: none;
    font-size: 12px;
    color: var(--text-secondary, #6b7280);
    cursor: pointer;
    transition: background-color 150ms;
}

.search-results__view-more:hover {
    background-color: var(--bg-hover, #f9fafb);
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
    .search-result-card {
        border-color: var(--border-color-dark, #374151);
    }
    
    .search-result-card:hover {
        background-color: var(--bg-hover-dark, #1f2937);
    }
    
    .search-result-card--grid .search-result-card__title {
        color: var(--text-primary-dark, #e5e7eb);
    }
    
    .search-result-card--grid .search-result-card__domain {
        color: var(--text-secondary-dark, #9ca3af);
    }
    
    .search-result-card--list .search-result-card__title {
        color: var(--text-primary-dark, #f3f4f6);
    }
    
    .search-result-card--list .search-result-card__snippet {
        color: var(--text-secondary-dark, #9ca3af);
    }
    
    .search-result-card--list .search-result-card__meta {
        color: var(--text-tertiary-dark, #6b7280);
    }
    
    .search-results__view-more {
        border-color: var(--border-color-dark, #374151);
        color: var(--text-secondary-dark, #9ca3af);
    }
    
    .search-results__view-more:hover {
        background-color: var(--bg-hover-dark, #1f2937);
    }
}
```

---

#### File: `src/components/features/chat/components/SearchResults.tsx`

```tsx
import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { SearchResultItem } from '@/search/types';
import '@/styles/features/search-results.css';

export interface SearchResultsProps {
    /** Array of search results */
    results: SearchResultItem[];
    /** Display mode - grid for compact, list for detailed */
    displayMode?: 'grid' | 'list';
    /** Maximum results to show initially in grid mode */
    initialCount?: number;
}

/**
 * Displays search results in grid or list format.
 * Grid mode shows compact cards, list mode shows detailed entries.
 * Optimized for sidepanel width (~400px).
 */
export const SearchResults: React.FC<SearchResultsProps> = ({
    results,
    displayMode = 'grid',
    initialCount = 4,
}) => {
    const [showAll, setShowAll] = useState(false);

    if (results.length === 0) {
        return null;
    }

    // Grid mode: show limited results with "View more" option
    const displayedResults = displayMode === 'grid' && !showAll
        ? results.slice(0, initialCount)
        : results;
    
    const hiddenCount = results.length - initialCount;

    // Extract domain from URL
    const getDomain = (url: string): string => {
        try {
            const hostname = new URL(url).hostname;
            return hostname.replace('www.', '');
        } catch {
            return url;
        }
    };

    // Get short domain name for display
    const getShortDomain = (url: string): string => {
        const domain = getDomain(url);
        const parts = domain.split('.');
        // Return first meaningful part (e.g., "stackoverflow" from "stackoverflow.com")
        return parts.length > 1 ? parts[0] : domain;
    };

    // Get favicon URL
    const getFaviconUrl = (url: string): string => {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
        } catch {
            return '';
        }
    };

    // List mode rendering
    if (displayMode === 'list') {
        return (
            <div className="search-results__list">
                {displayedResults.map((result, index) => (
                    <a
                        key={`${result.url}-${index}`}
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="search-result-card search-result-card--list"
                    >
                        <img
                            src={getFaviconUrl(result.url)}
                            alt=""
                            className="search-result-card__favicon"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                        <div className="search-result-card__content">
                            <div className="search-result-card__title">
                                {result.title || getDomain(result.url)}
                            </div>
                            <div className="search-result-card__snippet">
                                {result.content}
                            </div>
                            <div className="search-result-card__meta">
                                <span>{getDomain(result.url)}</span>
                                <span>•</span>
                                <span>{index + 1}</span>
                            </div>
                        </div>
                        <ExternalLink size={12} className="search-result-card__external-link" />
                    </a>
                ))}
            </div>
        );
    }

    // Grid mode rendering (default)
    return (
        <div className="search-results">
            <div className="search-results__grid">
                {displayedResults.map((result, index) => (
                    <a
                        key={`${result.url}-${index}`}
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="search-result-card search-result-card--grid"
                    >
                        <div className="search-result-card__title">
                            {result.title || result.content}
                        </div>
                        <div className="search-result-card__meta">
                            <img
                                src={getFaviconUrl(result.url)}
                                alt=""
                                className="search-result-card__favicon"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            <span className="search-result-card__domain">
                                {getShortDomain(result.url)} • {index + 1}
                            </span>
                        </div>
                    </a>
                ))}

                {/* "View more" card */}
                {!showAll && hiddenCount > 0 && (
                    <button
                        type="button"
                        onClick={() => setShowAll(true)}
                        className="search-results__view-more"
                    >
                        View {hiddenCount} more
                    </button>
                )}
            </div>
        </div>
    );
};

export default SearchResults;
```

---

### 4.3 Search Images Section
**Goal:** Display image results in a compact grid with lightbox preview

---

#### File: `src/styles/features/search-images.css`

```css
/* Search Images Section Styles */
.search-images__grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
}

.search-images__item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 4px;
    overflow: hidden;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: opacity 150ms;
}

.search-images__item:hover {
    opacity: 0.9;
}

.search-images__item:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-blue-500, #3b82f6);
}

.search-images__item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

/* Zoom overlay */
.search-images__zoom-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.3);
    opacity: 0;
    transition: opacity 150ms;
}

.search-images__item:hover .search-images__zoom-overlay {
    opacity: 1;
}

.search-images__zoom-overlay svg {
    color: white;
}

/* More count overlay */
.search-images__more-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    font-size: 14px;
    font-weight: 500;
}

/* Lightbox */
.search-images__lightbox {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.9);
}

.search-images__lightbox-close {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 10;
    padding: 8px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    border: none;
    cursor: pointer;
    transition: background-color 150ms;
}

.search-images__lightbox-close:hover {
    background-color: rgba(0, 0, 0, 0.7);
}

.search-images__lightbox-nav {
    position: absolute;
    z-index: 10;
    padding: 8px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    border: none;
    cursor: pointer;
    transition: background-color 150ms;
}

.search-images__lightbox-nav:hover {
    background-color: rgba(0, 0, 0, 0.7);
}

.search-images__lightbox-nav--prev {
    left: 16px;
}

.search-images__lightbox-nav--next {
    right: 16px;
}

.search-images__lightbox-content {
    max-width: 90vw;
    max-height: 80vh;
}

.search-images__lightbox-content img {
    max-width: 100%;
    max-height: 80vh;
    object-fit: contain;
}

.search-images__lightbox-description {
    margin-top: 8px;
    text-align: center;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
}

.search-images__lightbox-counter {
    margin-top: 8px;
    text-align: center;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
}
```

---

#### File: `src/components/features/chat/components/SearchResultsImageSection.tsx`

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import type { SearchResultImage } from '@/search/types';
import '@/styles/features/search-images.css';

export interface SearchResultsImageSectionProps {
    /** Array of image results */
    images: SearchResultImage[];
    /** Original search query for alt text */
    query?: string;
    /** Maximum images to show in preview */
    maxPreview?: number;
}

/**
 * Displays search result images in a compact grid.
 * Clicking an image opens a simple lightbox viewer.
 * Optimized for sidepanel width.
 */
export const SearchResultsImageSection: React.FC<SearchResultsImageSectionProps> = ({
    images,
    query = '',
    maxPreview = 4,
}) => {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // Normalize images to consistent format
    const normalizedImages = images.map((img) => {
        if (typeof img === 'string') {
            return { url: img, description: '' };
        }
        return img;
    }).filter((img) => img.url && img.url.length > 0);

    if (normalizedImages.length === 0) {
        return null;
    }

    const previewImages = normalizedImages.slice(0, maxPreview);
    const remainingCount = normalizedImages.length - maxPreview;

    // Navigate in lightbox
    const goToNext = () => {
        if (selectedIndex !== null) {
            setSelectedIndex((selectedIndex + 1) % normalizedImages.length);
        }
    };

    const goToPrev = () => {
        if (selectedIndex !== null) {
            setSelectedIndex((selectedIndex - 1 + normalizedImages.length) % normalizedImages.length);
        }
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (selectedIndex === null) return;
        if (e.key === 'ArrowRight') goToNext();
        if (e.key === 'ArrowLeft') goToPrev();
        if (e.key === 'Escape') setSelectedIndex(null);
    };

    return (
        <>
            {/* Image grid */}
            <div className="search-images__grid">
                {previewImages.map((image, index) => (
                    <button
                        key={`${image.url}-${index}`}
                        type="button"
                        onClick={() => setSelectedIndex(index)}
                        aria-label={`View image ${index + 1}${image.description ? `: ${image.description}` : ''}`}
                        className="search-images__item"
                    >
                        <img
                            src={image.url}
                            alt={image.description || `Search result ${index + 1} for ${query}`}
                            loading="lazy"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ccc"><rect width="24" height="24"/></svg>';
                            }}
                        />
                        
                        {/* Zoom indicator on hover */}
                        <div className="search-images__zoom-overlay">
                            <ZoomIn size={16} />
                        </div>

                        {/* "More" overlay on last image */}
                        {index === maxPreview - 1 && remainingCount > 0 && (
                            <div className="search-images__more-overlay">
                                +{remainingCount}
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {/* Lightbox modal */}
            {selectedIndex !== null && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Image viewer"
                    className="search-images__lightbox"
                    onClick={() => setSelectedIndex(null)}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                >
                    {/* Close button */}
                    <button
                        type="button"
                        onClick={() => setSelectedIndex(null)}
                        aria-label="Close image viewer"
                        className="search-images__lightbox-close"
                    >
                        <X size={20} />
                    </button>

                    {/* Previous button */}
                    {normalizedImages.length > 1 && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                            aria-label="Previous image"
                            className="search-images__lightbox-nav search-images__lightbox-nav--prev"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    )}

                    {/* Image */}
                    <div
                        className="search-images__lightbox-content"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={normalizedImages[selectedIndex].url}
                            alt={normalizedImages[selectedIndex].description || `Image ${selectedIndex + 1}`}
                        />
                        {/* Description */}
                        {normalizedImages[selectedIndex].description && (
                            <div className="search-images__lightbox-description">
                                {normalizedImages[selectedIndex].description}
                            </div>
                        )}
                        {/* Counter */}
                        <div className="search-images__lightbox-counter">
                            {selectedIndex + 1} / {normalizedImages.length}
                        </div>
                    </div>

                    {/* Next button */}
                    {normalizedImages.length > 1 && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); goToNext(); }}
                            aria-label="Next image"
                            className="search-images__lightbox-nav search-images__lightbox-nav--next"
                        >
                            <ChevronRight size={24} />
                        </button>
                    )}
                </div>
            )}
        </>
    );
};

export default SearchResultsImageSection;
```
                >
                    {/* Close button */}
                    <button
                        type="button"
                        onClick={() => setSelectedIndex(null)}
                        aria-label="Close image viewer"
                        className={cn(
                            'absolute top-4 right-4 z-10',
                            'p-2 rounded-full',
                            'bg-black/50 text-white',
                            'hover:bg-black/70',
                            'transition-colors'
                        )}
                    >
                        <X size={20} />
                    </button>

                    {/* Previous button */}
                    {normalizedImages.length > 1 && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                            aria-label="Previous image"
                            className={cn(
                                'absolute left-4 z-10',
                                'p-2 rounded-full',
                                'bg-black/50 text-white',
                                'hover:bg-black/70',
                                'transition-colors'
                            )}
                        >
                            <ChevronLeft size={24} />
                        </button>
                    )}

                    {/* Image */}
                    <div
                        className="max-w-[90vw] max-h-[80vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={normalizedImages[selectedIndex].url}
                            alt={normalizedImages[selectedIndex].description || `Image ${selectedIndex + 1}`}
                            className="max-w-full max-h-[80vh] object-contain"
                        />
                        {/* Description */}
                        {normalizedImages[selectedIndex].description && (
                            <div className="mt-2 text-center text-sm text-white/80">
                                {normalizedImages[selectedIndex].description}
                            </div>
                        )}
                        {/* Counter */}
                        <div className="mt-2 text-center text-xs text-white/60">
                            {selectedIndex + 1} / {normalizedImages.length}
                        </div>
                    </div>

                    {/* Next button */}
                    {normalizedImages.length > 1 && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); goToNext(); }}
                            aria-label="Next image"
                            className={cn(
                                'absolute right-4 z-10',
                                'p-2 rounded-full',
                                'bg-black/50 text-white',
                                'hover:bg-black/70',
                                'transition-colors'
                            )}
                        >
                            <ChevronRight size={24} />
                        </button>
                    )}
                </div>
            )}
        </>
    );
};

export default SearchResultsImageSection;
```

---

### 4.4 Retrieve Section Component
**Goal:** Display URL content retrieval results

---

#### File: `src/styles/features/retrieve-section.css`

```css
/* Retrieve Section Styles - similar to search section */
.retrieve-section {
    border-radius: 8px;
    border: 1px solid var(--border-color, #e5e7eb);
    background-color: var(--bg-primary, #ffffff);
    overflow: hidden;
}

.retrieve-section__header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    transition: background-color 150ms;
}

.retrieve-section__header:hover {
    background-color: var(--bg-hover, #f9fafb);
}

.retrieve-section__icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(168, 85, 247, 0.1);
    color: var(--color-purple-600, #9333ea);
}

.retrieve-section__icon--loading svg {
    animation: spin 1s linear infinite;
}

.retrieve-section__url {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    color: var(--text-primary, #374151);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.retrieve-section__badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    font-size: 12px;
    font-weight: 500;
    background-color: rgba(34, 197, 94, 0.1);
    color: var(--color-green-700, #15803d);
    border-radius: 9999px;
}

.retrieve-section__chevron {
    flex-shrink: 0;
    color: var(--text-tertiary, #9ca3af);
    transition: transform 200ms;
}

.retrieve-section__chevron--open {
    transform: rotate(180deg);
}

.retrieve-section__content {
    border-top: 1px solid var(--border-color, #e5e7eb);
}

.retrieve-section__content-inner {
    padding: 12px;
}

.retrieve-section__content-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
    margin-bottom: 8px;
}

.retrieve-section__error {
    font-size: 14px;
    color: var(--text-secondary, #6b7280);
    text-align: center;
    padding: 12px;
}

/* Skeleton */
.retrieve-section__skeleton {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.retrieve-section__skeleton-line {
    height: 16px;
    border-radius: 4px;
    background-color: var(--bg-skeleton, #f3f4f6);
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.retrieve-section__skeleton-line--short {
    width: 75%;
}

.retrieve-section__skeleton-line--medium {
    width: 100%;
}

.retrieve-section__skeleton-line--long {
    width: 66%;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
    .retrieve-section {
        border-color: var(--border-color-dark, #374151);
        background-color: var(--bg-primary-dark, #111827);
    }
    
    .retrieve-section__header:hover {
        background-color: var(--bg-hover-dark, #1f2937);
    }
    
    .retrieve-section__icon {
        background-color: rgba(168, 85, 247, 0.2);
        color: var(--color-purple-400, #c084fc);
    }
    
    .retrieve-section__url {
        color: var(--text-primary-dark, #e5e7eb);
    }
    
    .retrieve-section__badge {
        background-color: rgba(34, 197, 94, 0.2);
        color: var(--color-green-400, #4ade80);
    }
    
    .retrieve-section__content {
        border-color: var(--border-color-dark, #374151);
    }
    
    .retrieve-section__content-label {
        color: var(--text-secondary-dark, #9ca3af);
    }
    
    .retrieve-section__error {
        color: var(--text-secondary-dark, #9ca3af);
    }
    
    .retrieve-section__skeleton-line {
        background-color: var(--bg-skeleton-dark, #1f2937);
    }
}
```

---

#### File: `src/components/features/chat/components/RetrieveSection.tsx`

```tsx
import React from 'react';
import { ChevronDown, Link, Check, Loader2 } from 'lucide-react';
import type { ToolInvocation } from 'ai';
import type { SearchResults as SearchResultsType } from '@/search/types';
import { SearchResults } from './SearchResults';
import '@/styles/features/retrieve-section.css';

export interface RetrieveSectionProps {
    /** Tool invocation data from AI SDK */
    tool: ToolInvocation;
    /** Whether the section is expanded */
    isOpen: boolean;
    /** Callback when open state changes */
    onOpenChange: (open: boolean) => void;
}

/**
 * Collapsible section displaying URL retrieval results.
 * Similar to SearchSection but for single URL content.
 */
export const RetrieveSection: React.FC<RetrieveSectionProps> = ({
    tool,
    isOpen,
    onOpenChange,
}) => {
    const isLoading = tool.state === 'call';
    const data: SearchResultsType | undefined = 
        tool.state === 'result' ? tool.result : undefined;
    
    const url = (tool.args as { url?: string })?.url || '';
    
    // Extract domain for display
    const getDomain = (urlStr: string): string => {
        try {
            return new URL(urlStr).hostname.replace('www.', '');
        } catch {
            return urlStr;
        }
    };

    const hasResults = (data?.results?.length || 0) > 0;

    const iconClasses = ['retrieve-section__icon', isLoading && 'retrieve-section__icon--loading'].filter(Boolean).join(' ');
    const chevronClasses = ['retrieve-section__chevron', isOpen && 'retrieve-section__chevron--open'].filter(Boolean).join(' ');

    return (
        <div className="retrieve-section">
            {/* Header */}
            <button
                type="button"
                onClick={() => onOpenChange(!isOpen)}
                aria-expanded={isOpen}
                aria-label={`Retrieved content from ${getDomain(url)}`}
                className="retrieve-section__header"
            >
                {/* Icon */}
                <div className={iconClasses}>
                    {isLoading ? (
                        <Loader2 size={14} />
                    ) : (
                        <Link size={14} />
                    )}
                </div>

                {/* URL text */}
                <span className="retrieve-section__url">
                    {getDomain(url) || 'Retrieving...'}
                </span>

                {/* Success badge */}
                {!isLoading && hasResults && (
                    <span className="retrieve-section__badge">
                        <Check size={10} />
                        Retrieved
                    </span>
                )}

                {/* Chevron */}
                <ChevronDown size={16} className={chevronClasses} />
            </button>

            {/* Content */}
            {isOpen && (
                <div className="retrieve-section__content">
                    {isLoading ? (
                        <div className="retrieve-section__skeleton">
                            <div className="retrieve-section__skeleton-line retrieve-section__skeleton-line--short" />
                            <div className="retrieve-section__skeleton-line retrieve-section__skeleton-line--medium" />
                            <div className="retrieve-section__skeleton-line retrieve-section__skeleton-line--long" />
                        </div>
                    ) : data && hasResults ? (
                        <div className="retrieve-section__content-inner">
                            <div className="retrieve-section__content-label">
                                Content
                            </div>
                            <SearchResults 
                                results={data.results} 
                                displayMode="list" 
                            />
                        </div>
                    ) : (
                        <div className="retrieve-section__error">
                            Could not retrieve content from this URL
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RetrieveSection;
```

---

### 4.5 Component Exports

#### File: `src/components/features/chat/components/search/index.ts`

```typescript
// Search result display components
export { SearchSection } from '../SearchSection';
export { SearchResults } from '../SearchResults';
export { SearchResultsImageSection } from '../SearchResultsImageSection';
export { RetrieveSection } from '../RetrieveSection';
```

---

## Phase 5: AI Agent Integration

### 5.1 Search System Prompt
**Goal:** Instruct the AI when and how to use search with citation format

---

#### File: `src/ai/prompts/searchPrompt.ts`

```typescript
/**
 * System prompt additions for web search capability.
 * Append this to the main agent system prompt when search mode is enabled.
 */

export const SEARCH_SYSTEM_PROMPT = `
## Web Search Capability

You have access to real-time web search and URL content retrieval tools.

### When to Use Web Search
Use the webSearch tool when:
- User asks about current events, news, or recent information
- User asks for facts you're uncertain about or that may have changed
- User asks about specific products, prices, or availability
- User asks about people, places, or things that may have recent updates
- Information requires up-to-date data (weather, stocks, sports scores)

Do NOT search when:
- You're confident in your knowledge and it's unlikely to have changed
- The question is about general concepts or definitions
- User explicitly asks you to use your existing knowledge

### When to Use Retrieve
Use the retrieve tool when:
- You found a relevant URL from search results that needs deeper reading
- User provides a specific URL they want you to analyze
- You need the full content of an article, not just a snippet

### Search Depth Selection
- Use "basic" (default) for simple factual queries
- Use "advanced" for complex topics requiring comprehensive coverage

### Citation Format
ALWAYS cite your sources when using information from search results.

Format: [Source Title](url) or [number](url)

Examples:
- According to [The New York Times](https://nytimes.com/article), ...
- Recent studies show [1](https://example.com/study1), [2](https://example.com/study2)...

Rules:
1. Cite sources inline where the information is used
2. Use the exact URL from search results
3. If multiple sources confirm the same fact, cite the most authoritative
4. Never fabricate citations - only cite actual search results
5. If search returns no relevant results, say so and use general knowledge

### Response Structure for Search Queries
1. Search for relevant information
2. Synthesize findings into a coherent response
3. Include citations for factual claims
4. Note if information is time-sensitive
`;

/**
 * Brief reminder to add to user messages when search is enabled.
 */
export const SEARCH_USER_REMINDER = `
[Search mode is enabled - use webSearch for current information and cite sources]
`;

/**
 * Gets the appropriate search prompt based on mode.
 */
export function getSearchPromptAddition(searchEnabled: boolean): string {
    return searchEnabled ? SEARCH_SYSTEM_PROMPT : '';
}
```

---

### 5.2 Search Tool Filtering
**Goal:** Enable/disable search tools based on search mode setting

---

#### File: `src/ai/tools/searchToolFilter.ts`

```typescript
import { createLogger } from '~logger';
import { WEB_SEARCH_TOOL_NAME } from '@/actions/search/useWebSearch';
import { RETRIEVE_TOOL_NAME } from '@/actions/search/useRetrieve';

const log = createLogger('SearchToolFilter', 'AI');

/** Names of all search-related tools */
export const SEARCH_TOOL_NAMES = [
    WEB_SEARCH_TOOL_NAME, // 'webSearch'
    RETRIEVE_TOOL_NAME,   // 'retrieve'
] as const;

export type SearchToolName = typeof SEARCH_TOOL_NAMES[number];

/**
 * Checks if a tool name is a search tool.
 */
export function isSearchTool(toolName: string): toolName is SearchToolName {
    return SEARCH_TOOL_NAMES.includes(toolName as SearchToolName);
}

/**
 * Filters tool list based on search mode.
 * When search mode is disabled, removes search tools from the list.
 * 
 * @param allTools - Array of all available tool names
 * @param searchEnabled - Whether search mode is enabled
 * @returns Filtered array of tool names
 */
export function filterToolsBySearchMode(
    allTools: string[],
    searchEnabled: boolean
): string[] {
    if (searchEnabled) {
        log.debug('Search mode enabled, including search tools');
        return allTools;
    }

    const filtered = allTools.filter((tool) => !isSearchTool(tool));
    log.debug('Search mode disabled, excluding search tools', {
        removed: allTools.length - filtered.length,
    });
    return filtered;
}

/**
 * Gets the list of active tools based on search mode.
 * Used with AI SDK's experimental_activeTools parameter.
 * 
 * @param searchEnabled - Whether search mode is enabled
 * @returns Array of active search tool names, or empty array if disabled
 */
export function getActiveSearchTools(searchEnabled: boolean): string[] {
    return searchEnabled ? [...SEARCH_TOOL_NAMES] : [];
}

/**
 * Counts how many search tools are in a tool list.
 */
export function countSearchTools(tools: string[]): number {
    return tools.filter((t) => isSearchTool(t)).length;
}
```

---

### 5.3 Agent Configuration Update
**Goal:** Integrate search mode into the AI agent

---

#### File: `src/ai/agents/searchAgentConfig.ts`

```typescript
import { createLogger } from '~logger';
import { getSearchPromptAddition } from '@/ai/prompts/searchPrompt';
import { filterToolsBySearchMode, getActiveSearchTools } from '@/ai/tools/searchToolFilter';

const log = createLogger('SearchAgentConfig', 'AI');

/**
 * Configuration for AI agent with search capabilities.
 */
export interface SearchAgentConfig {
    /** Whether search mode is enabled */
    searchEnabled: boolean;
    /** Search depth preference */
    searchDepth: 'basic' | 'advanced';
    /** Maximum tool execution steps (higher when search enabled) */
    maxSteps: number;
    /** Additional system prompt for search */
    systemPromptAddition: string;
    /** Tool names to include/exclude based on search mode */
    activeTools: string[];
}

/**
 * Creates search-aware agent configuration.
 * 
 * @param baseTools - Array of all registered tool names
 * @param searchEnabled - Whether search mode is enabled
 * @param searchDepth - Preferred search depth
 * @returns Configuration object for agent
 */
export function createSearchAgentConfig(
    baseTools: string[],
    searchEnabled: boolean,
    searchDepth: 'basic' | 'advanced' = 'basic'
): SearchAgentConfig {
    const activeTools = filterToolsBySearchMode(baseTools, searchEnabled);
    
    // Increase max steps when search is enabled to allow for search + retrieval chains
    const maxSteps = searchEnabled ? 5 : 3;

    log.debug('Created search agent config', {
        searchEnabled,
        searchDepth,
        maxSteps,
        toolCount: activeTools.length,
    });

    return {
        searchEnabled,
        searchDepth,
        maxSteps,
        systemPromptAddition: getSearchPromptAddition(searchEnabled),
        activeTools,
    };
}

/**
 * Merges search configuration into existing agent options.
 * Use this when configuring the streamText or generateText call.
 * 
 * @param baseConfig - Base agent configuration
 * @param searchConfig - Search configuration from createSearchAgentConfig
 * @returns Merged configuration
 */
export function mergeSearchConfig<T extends { system?: string; maxSteps?: number }>(
    baseConfig: T,
    searchConfig: SearchAgentConfig
): T & { system: string; maxSteps: number } {
    const mergedSystem = baseConfig.system 
        ? `${baseConfig.system}\n\n${searchConfig.systemPromptAddition}`
        : searchConfig.systemPromptAddition;

    return {
        ...baseConfig,
        system: mergedSystem.trim(),
        maxSteps: searchConfig.maxSteps,
    };
}
```

---

### 5.4 Integration Example
**Goal:** Show how to integrate search into the existing AI chat flow

---

#### Usage in `src/ai/core/aiLogic.ts` (Integration Example)

```typescript
// Example integration - add to existing aiLogic.ts

import { createSearchAgentConfig, mergeSearchConfig } from '@/ai/agents/searchAgentConfig';
import { getSearchSettings } from '@/utils/settings/searchSettings';

/**
 * Example: Creating a search-aware chat stream
 */
async function createChatStreamWithSearch(
    messages: CoreMessage[],
    registeredTools: Record<string, Tool>,
    searchModeEnabled: boolean,
    searchDepth: 'basic' | 'advanced'
) {
    // Get all registered tool names
    const allToolNames = Object.keys(registeredTools);
    
    // Create search-aware configuration
    const searchConfig = createSearchAgentConfig(
        allToolNames,
        searchModeEnabled,
        searchDepth
    );
    
    // Base agent configuration
    const baseConfig = {
        model: getModel(),
        system: BASE_SYSTEM_PROMPT,
        messages,
        tools: registeredTools,
        maxSteps: 3,
    };
    
    // Merge search configuration
    const finalConfig = mergeSearchConfig(baseConfig, searchConfig);
    
    // Filter tools if needed
    const activeToolSet = searchConfig.activeTools.reduce((acc, name) => {
        if (registeredTools[name]) {
            acc[name] = registeredTools[name];
        }
        return acc;
    }, {} as Record<string, Tool>);
    
    return streamText({
        ...finalConfig,
        tools: activeToolSet,
        // Optional: Use experimental_activeTools for more control
        // experimental_activeTools: searchConfig.activeTools,
    });
}
```

---

### 5.5 Search Mode Hook Integration
**Goal:** Connect search mode state to the AI chat system

---

#### File: `src/hooks/useSearchModeWithAI.ts`

```typescript
import { useMemo } from 'react';
import { useSearchMode } from '@/hooks/useSearchMode';
import { createSearchAgentConfig, type SearchAgentConfig } from '@/ai/agents/searchAgentConfig';

/**
 * Extended search mode hook that provides AI configuration.
 * Use this in components that need both search UI state and AI config.
 */
export function useSearchModeWithAI(registeredToolNames: string[]): {
    /** All properties from useSearchMode */
    isSearchMode: boolean;
    toggleSearchMode: () => void;
    setSearchMode: (enabled: boolean) => void;
    searchDepth: 'basic' | 'advanced';
    setSearchDepth: (depth: 'basic' | 'advanced') => void;
    hasApiKey: boolean;
    isLoading: boolean;
    /** AI configuration based on current search state */
    aiConfig: SearchAgentConfig;
} {
    const searchMode = useSearchMode();
    
    // Memoize AI config to avoid recreating on every render
    const aiConfig = useMemo(() => {
        return createSearchAgentConfig(
            registeredToolNames,
            searchMode.isSearchMode && searchMode.hasApiKey,
            searchMode.searchDepth
        );
    }, [
        registeredToolNames,
        searchMode.isSearchMode,
        searchMode.hasApiKey,
        searchMode.searchDepth,
    ]);

    return {
        ...searchMode,
        aiConfig,
    };
}

export default useSearchModeWithAI;
```

---

## Phase 6: Settings & Configuration UI

### 6.1 Search Settings Component
**Goal:** Add search configuration to settings page with API key management

**Design Notes for Chrome Sidepanel:**
- Uses existing settings CSS classes (`.settings-section`, `.settings-card`, `.settings-item`)
- Collapsible sections to save vertical space
- Compact inputs and dropdowns
- API keys stored securely in Chrome storage (separate from regular settings)

---

#### File: `src/components/features/settings/components/SearchSettingsSection.tsx`

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Globe, ChevronUp, ChevronDown, Key, ExternalLink, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { createLogger } from '~logger';
import {
    getSearchSettings,
    saveSearchSettings,
    getSearchApiKeys,
    saveSearchApiKeys,
    DEFAULT_SEARCH_SETTINGS,
    type SearchSettings,
    type SearchApiKeys,
} from '@/utils/settings/searchSettings';
import { Toggle } from '@/components/shared/inputs/Toggle';
import { cn } from '@/utils/cn';

const log = createLogger('SearchSettingsSection', 'SETTINGS');

/** Provider configuration with signup URLs and key validation */
interface ProviderConfig {
    id: 'tavily';
    name: string;
    signupUrl: string;
    placeholder: string;
    keyPrefix: string;
    description: string;
}

const PROVIDERS: ProviderConfig[] = [
    {
        id: 'tavily',
        name: 'Tavily',
        signupUrl: 'https://tavily.com',
        placeholder: 'tvly-...',
        keyPrefix: 'tvly-',
        description: 'AI-optimized search API. 1000 free searches/month.',
    },
];

/** Test result state */
interface TestResult {
    provider: string;
    success: boolean;
    message: string;
}

export const SearchSettingsSection: React.FC = () => {
    const [settings, setSettings] = useState<SearchSettings>(DEFAULT_SEARCH_SETTINGS);
    const [apiKeys, setApiKeys] = useState<SearchApiKeys>({});
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [isApiKeysOpen, setIsApiKeysOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [isTesting, setIsTesting] = useState(false);

    // Load settings on mount
    useEffect(() => {
        const loadAll = async () => {
            try {
                const [loadedSettings, loadedKeys] = await Promise.all([
                    getSearchSettings(),
                    getSearchApiKeys(),
                ]);
                setSettings(loadedSettings);
                setApiKeys(loadedKeys);
            } catch (error) {
                log.error('Failed to load search settings', { 
                    error: error instanceof Error ? error.message : 'Unknown error' 
                });
            } finally {
                setIsLoading(false);
            }
        };
        loadAll();
    }, []);

    // Save settings helper
    const updateSettings = useCallback(async (updates: Partial<SearchSettings>) => {
        const newSettings = { ...settings, ...updates };
        setSettings(newSettings);
        try {
            await saveSearchSettings(newSettings);
            log.debug('Settings saved', { updates });
        } catch (error) {
            log.error('Failed to save settings', { 
                error: error instanceof Error ? error.message : 'Unknown error' 
            });
            // Revert on failure
            setSettings(settings);
        }
    }, [settings]);

    // Save API key helper
    const updateApiKey = useCallback(async (provider: keyof SearchApiKeys, value: string) => {
        const newKeys = { ...apiKeys, [provider]: value };
        setApiKeys(newKeys);
        try {
            await saveSearchApiKeys(newKeys);
            log.debug('API key saved', { provider });
            setTestResult(null); // Clear previous test result
        } catch (error) {
            log.error('Failed to save API key', { 
                error: error instanceof Error ? error.message : 'Unknown error' 
            });
            setApiKeys(apiKeys);
        }
    }, [apiKeys]);

    // Test API key connection
    const testConnection = useCallback(async (provider: ProviderConfig) => {
        const key = apiKeys[provider.id];
        if (!key) {
            setTestResult({ provider: provider.id, success: false, message: 'No API key entered' });
            return;
        }

        setIsTesting(true);
        setTestResult(null);

        try {
            // Test with a simple search query
            const response = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_key: key,
                    query: 'test',
                    max_results: 1,
                    search_depth: 'basic',
                }),
            });

            if (response.ok) {
                setTestResult({ provider: provider.id, success: true, message: 'Connection successful!' });
            } else {
                const errorText = await response.text();
                setTestResult({ 
                    provider: provider.id, 
                    success: false, 
                    message: response.status === 401 ? 'Invalid API key' : `Error: ${response.status}` 
                });
            }
        } catch (error) {
            setTestResult({ 
                provider: provider.id, 
                success: false, 
                message: 'Connection failed. Check your network.' 
            });
        } finally {
            setIsTesting(false);
        }
    }, [apiKeys]);

    if (isLoading) {
        return (
            <div className="settings-section">
                <div className="settings-card" style={{ padding: '24px', textAlign: 'center' }}>
                    <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto' }} />
                </div>
            </div>
        );
    }

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2 className="settings-section-title">
                    <Globe size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    Web Search
                </h2>
            </div>
            
            <div className="settings-card">
                {/* Enable/Disable Toggle */}
                <div className="settings-item">
                    <div className="settings-item-content">
                        <div className="settings-item-title">Enable Web Search</div>
                        <div className="settings-item-description">
                            Allow AI to search the web for current information
                        </div>
                    </div>
                    <Toggle
                        checked={settings.enabled}
                        onChange={(checked) => updateSettings({ enabled: checked })}
                    />
                </div>

                {/* Expandable sections only when enabled */}
                {settings.enabled && (
                    <>
                        {/* Search Options Accordion */}
                        <div className="settings-item" style={{ display: 'block', padding: 0 }}>
                            <button
                                type="button"
                                onClick={() => setIsOptionsOpen(!isOptionsOpen)}
                                aria-expanded={isOptionsOpen}
                                aria-label="Toggle search options"
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'inherit',
                                    textAlign: 'left',
                                }}
                            >
                                <div>
                                    <div className="settings-item-title">Search Options</div>
                                    <div className="settings-item-description">
                                        {settings.defaultSearchDepth} • {settings.maxResults} results
                                        {settings.includeImages ? ' • images' : ''}
                                    </div>
                                </div>
                                {isOptionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {isOptionsOpen && (
                                <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
                                    {/* Search Depth */}
                                    <div style={{ marginBottom: '12px' }}>
                                        <label className="settings-item-title" style={{ display: 'block', marginBottom: '6px' }}>
                                            Default Search Depth
                                        </label>
                                        <select
                                            className="settings-select"
                                            value={settings.defaultSearchDepth}
                                            onChange={(e) => updateSettings({ 
                                                defaultSearchDepth: e.target.value as 'basic' | 'advanced' 
                                            })}
                                            style={{ width: '100%' }}
                                        >
                                            <option value="basic">Basic - Faster, fewer results</option>
                                            <option value="advanced">Advanced - Thorough, more results</option>
                                        </select>
                                    </div>

                                    {/* Max Results */}
                                    <div style={{ marginBottom: '12px' }}>
                                        <label className="settings-item-title" style={{ display: 'block', marginBottom: '6px' }}>
                                            Maximum Results
                                        </label>
                                        <select
                                            className="settings-select"
                                            value={settings.maxResults}
                                            onChange={(e) => updateSettings({ maxResults: Number(e.target.value) })}
                                            style={{ width: '100%' }}
                                        >
                                            <option value={5}>5 results</option>
                                            <option value={10}>10 results (recommended)</option>
                                            <option value={15}>15 results</option>
                                            <option value={20}>20 results</option>
                                        </select>
                                    </div>

                                    {/* Include Images */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div className="settings-item-title">Include Images</div>
                                            <div className="settings-item-description">
                                                Show image results when available
                                            </div>
                                        </div>
                                        <Toggle
                                            checked={settings.includeImages}
                                            onChange={(checked) => updateSettings({ includeImages: checked })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* API Keys Accordion */}
                        <div className="settings-item" style={{ display: 'block', padding: 0 }}>
                            <button
                                type="button"
                                onClick={() => setIsApiKeysOpen(!isApiKeysOpen)}
                                aria-expanded={isApiKeysOpen}
                                aria-label="Toggle API keys section"
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'inherit',
                                    textAlign: 'left',
                                }}
                            >
                                <div>
                                    <div className="settings-item-title">
                                        <Key size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
                                        API Key
                                    </div>
                                    <div className="settings-item-description">
                                        {apiKeys.tavily ? 'Configured ✓' : 'Not configured'}
                                    </div>
                                </div>
                                {isApiKeysOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {isApiKeysOpen && (
                                <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
                                    {PROVIDERS.map((provider) => (
                                        <div key={provider.id} style={{ marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                <label className="settings-item-title">{provider.name} API Key</label>
                                                <a
                                                    href={provider.signupUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        fontSize: '11px',
                                                        color: 'var(--text-secondary)',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                    }}
                                                >
                                                    Get API key <ExternalLink size={10} />
                                                </a>
                                            </div>
                                            <div className="settings-item-description" style={{ marginBottom: '6px' }}>
                                                {provider.description}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input
                                                    type="password"
                                                    className="settings-input"
                                                    placeholder={provider.placeholder}
                                                    value={apiKeys[provider.id] || ''}
                                                    onChange={(e) => updateApiKey(provider.id, e.target.value)}
                                                    style={{ flex: 1 }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => testConnection(provider)}
                                                    disabled={isTesting || !apiKeys[provider.id]}
                                                    className="settings-button"
                                                    style={{
                                                        padding: '6px 12px',
                                                        fontSize: '12px',
                                                        borderRadius: '6px',
                                                        border: '1px solid var(--border-color)',
                                                        background: 'var(--bg-secondary)',
                                                        cursor: isTesting || !apiKeys[provider.id] ? 'not-allowed' : 'pointer',
                                                        opacity: isTesting || !apiKeys[provider.id] ? 0.5 : 1,
                                                    }}
                                                >
                                                    {isTesting ? <Loader2 size={12} className="animate-spin" /> : 'Test'}
                                                </button>
                                            </div>
                                            
                                            {/* Test result display */}
                                            {testResult && testResult.provider === provider.id && (
                                                <div
                                                    style={{
                                                        marginTop: '8px',
                                                        padding: '8px',
                                                        borderRadius: '6px',
                                                        fontSize: '12px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        background: testResult.success 
                                                            ? 'rgba(34, 197, 94, 0.1)' 
                                                            : 'rgba(239, 68, 68, 0.1)',
                                                        color: testResult.success 
                                                            ? 'rgb(34, 197, 94)' 
                                                            : 'rgb(239, 68, 68)',
                                                    }}
                                                >
                                                    {testResult.success 
                                                        ? <CheckCircle size={14} /> 
                                                        : <XCircle size={14} />
                                                    }
                                                    {testResult.message}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default SearchSettingsSection;
```

---

#### Integration: Update `src/components/features/settings/SettingsPage.tsx`

Add the import and component to the settings page:

```tsx
// Add to imports at top of file
import { SearchSettingsSection } from '@/components/features/settings/components/SearchSettingsSection';

// In the settings-content div, add after WriteCommandSettings:
<SearchSettingsSection />
```

---

## Phase 7: Answer Enhancement

### 7.1 Source Citations in Messages
**Goal:** Display inline citation links `[1]`, `[2]` that link to search result sources

**Design Notes for Chrome Sidepanel:**
- Small, unobtrusive citation badges
- Hover shows source preview (title + domain)
- Click opens source URL in new tab
- Uses superscript numbers to save horizontal space

---

#### File: `src/styles/features/source-citation.css`

```css
/* Source Citation Styles */
.source-citation {
    display: inline-block;
    position: relative;
}

.source-citation__trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    font-size: 10px;
    font-weight: 500;
    background-color: rgba(59, 130, 246, 0.1);
    color: var(--color-blue-600, #2563eb);
    border-radius: 2px;
    border: none;
    cursor: pointer;
    transition: background-color 100ms;
    vertical-align: super;
    margin-top: -4px;
}

.source-citation__trigger:hover {
    background-color: rgba(59, 130, 246, 0.2);
}

/* Tooltip */
.source-citation__tooltip {
    position: absolute;
    z-index: 50;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 4px;
    width: 200px;
    padding: 8px;
    background-color: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 8px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    pointer-events: none;
}

.source-citation__tooltip-content {
    display: flex;
    align-items: flex-start;
    gap: 8px;
}

.source-citation__favicon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    margin-top: 2px;
    border-radius: 2px;
}

.source-citation__info {
    overflow: hidden;
}

.source-citation__title {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary, #111827);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.source-citation__url {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    font-size: 10px;
    color: var(--text-secondary, #6b7280);
}

.source-citation__url span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
    .source-citation__trigger {
        color: var(--color-blue-400, #60a5fa);
    }
    
    .source-citation__tooltip {
        background-color: var(--bg-primary-dark, #1f2937);
        border-color: var(--border-color-dark, #374151);
    }
    
    .source-citation__title {
        color: var(--text-primary-dark, #f3f4f6);
    }
    
    .source-citation__url {
        color: var(--text-secondary-dark, #9ca3af);
    }
}
```

---

#### File: `src/components/features/chat/components/SourceCitation.tsx`

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import '@/styles/features/source-citation.css';

export interface CitationSource {
    /** Citation number (1, 2, 3...) */
    number: number;
    /** Source title */
    title: string;
    /** Source URL */
    url: string;
    /** Optional favicon URL */
    favicon?: string;
}

export interface SourceCitationProps {
    /** Citation data */
    source: CitationSource;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Inline citation component that shows a numbered reference.
 * Displays a tooltip preview on hover and opens URL on click.
 */
export const SourceCitation: React.FC<SourceCitationProps> = ({ source, className }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    // Extract domain from URL for display
    const getDomain = (url: string): string => {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return url;
        }
    };

    // Get favicon URL
    const getFaviconUrl = (url: string): string => {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
        } catch {
            return '';
        }
    };

    // Position tooltip within viewport
    useEffect(() => {
        if (showTooltip && tooltipRef.current && triggerRef.current) {
            const tooltip = tooltipRef.current;
            
            // Reset positioning
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translateX(-50%)';
            
            // Check if tooltip goes off screen
            const tooltipRect = tooltip.getBoundingClientRect();
            if (tooltipRect.right > window.innerWidth - 10) {
                tooltip.style.left = 'auto';
                tooltip.style.right = '0';
                tooltip.style.transform = 'none';
            } else if (tooltipRect.left < 10) {
                tooltip.style.left = '0';
                tooltip.style.transform = 'none';
            }
        }
    }, [showTooltip]);

    const handleClick = () => {
        window.open(source.url, '_blank', 'noopener,noreferrer');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
        }
    };

    const containerClasses = ['source-citation', className].filter(Boolean).join(' ');

    return (
        <span className={containerClasses}>
            <button
                ref={triggerRef}
                type="button"
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onFocus={() => setShowTooltip(true)}
                onBlur={() => setShowTooltip(false)}
                aria-label={`Source ${source.number}: ${source.title}`}
                className="source-citation__trigger"
            >
                {source.number}
            </button>

            {/* Tooltip */}
            {showTooltip && (
                <div ref={tooltipRef} role="tooltip" className="source-citation__tooltip">
                    <div className="source-citation__tooltip-content">
                        <img
                            src={source.favicon || getFaviconUrl(source.url)}
                            alt=""
                            className="source-citation__favicon"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                        <div className="source-citation__info">
                            <div className="source-citation__title">
                                {source.title}
                            </div>
                            <div className="source-citation__url">
                                <ExternalLink size={10} />
                                <span>{getDomain(source.url)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </span>
    );
};

export default SourceCitation;
```

---

#### File: `src/styles/features/citation-list.css`

```css
/* Citation List Styles */
.citation-list {
    margin-top: 12px;
    border-top: 1px solid var(--border-color, #e5e7eb);
    padding-top: 12px;
}

.citation-list__header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    font-size: 12px;
    color: var(--text-secondary, #6b7280);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: color 150ms;
}

.citation-list__header:hover {
    color: var(--text-primary, #374151);
}

.citation-list__chevron {
    margin-left: auto;
    transition: transform 200ms;
}

.citation-list__chevron--open {
    transform: rotate(180deg);
}

.citation-list__items {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.citation-list__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    border-radius: 6px;
    text-decoration: none;
    transition: background-color 100ms;
}

.citation-list__item:hover {
    background-color: var(--bg-hover, #f3f4f6);
}

.citation-list__number {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 500;
    background-color: rgba(59, 130, 246, 0.1);
    color: var(--color-blue-600, #2563eb);
    border-radius: 2px;
}

.citation-list__favicon {
    flex-shrink: 0;
    width: 12px;
    height: 12px;
    border-radius: 2px;
}

.citation-list__title {
    flex: 1;
    font-size: 12px;
    color: var(--text-primary, #374151);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.citation-list__link-icon {
    flex-shrink: 0;
    opacity: 0;
    color: var(--text-tertiary, #9ca3af);
    transition: opacity 150ms;
}

.citation-list__item:hover .citation-list__link-icon {
    opacity: 1;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
    .citation-list {
        border-color: var(--border-color-dark, #374151);
    }
    
    .citation-list__header {
        color: var(--text-secondary-dark, #9ca3af);
    }
    
    .citation-list__header:hover {
        color: var(--text-primary-dark, #d1d5db);
    }
    
    .citation-list__item:hover {
        background-color: var(--bg-hover-dark, #1f2937);
    }
    
    .citation-list__number {
        color: var(--color-blue-400, #60a5fa);
    }
    
    .citation-list__title {
        color: var(--text-primary-dark, #d1d5db);
    }
}
```

---

#### File: `src/components/features/chat/components/CitationList.tsx`

```tsx
import React from 'react';
import { Newspaper, ExternalLink } from 'lucide-react';
import type { CitationSource } from './SourceCitation';
import '@/styles/features/citation-list.css';

export interface CitationListProps {
    /** Array of citation sources */
    sources: CitationSource[];
    /** Whether the list is collapsed by default */
    defaultCollapsed?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Compact list of all sources cited in a message.
 * Displayed at the end of AI responses that include citations.
 */
export const CitationList: React.FC<CitationListProps> = ({
    sources,
    defaultCollapsed = true,
    className,
}) => {
    const [isExpanded, setIsExpanded] = React.useState(!defaultCollapsed);

    if (sources.length === 0) return null;

    // Get favicon URL
    const getFaviconUrl = (url: string): string => {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
        } catch {
            return '';
        }
    };

    const containerClasses = ['citation-list', className].filter(Boolean).join(' ');
    const chevronClasses = ['citation-list__chevron', isExpanded && 'citation-list__chevron--open'].filter(Boolean).join(' ');

    return (
        <div className={containerClasses}>
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${sources.length} sources`}
                className="citation-list__header"
            >
                <Newspaper size={12} />
                <span>{sources.length} source{sources.length !== 1 ? 's' : ''}</span>
                <span className={chevronClasses}>▼</span>
            </button>

            {isExpanded && (
                <div className="citation-list__items">
                    {sources.map((source) => (
                        <a
                            key={source.number}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="citation-list__item"
                        >
                            <span className="citation-list__number">
                                {source.number}
                            </span>
                            <img
                                src={source.favicon || getFaviconUrl(source.url)}
                                alt=""
                                className="citation-list__favicon"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            <span className="citation-list__title">
                                {source.title}
                            </span>
                            <ExternalLink size={10} className="citation-list__link-icon" />
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CitationList;
```

---

### 7.2 Related Questions
**Goal:** Show AI-generated follow-up question suggestions

**Design Notes for Chrome Sidepanel:**
- Compact list format (not cards)
- Arrow icon prefix for visual hierarchy
- Click to submit as new query
- Limited to 3 suggestions to save space

---

#### File: `src/styles/features/related-questions.css`

```css
/* Related Questions Styles */
.related-questions {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color, #e5e7eb);
}

.related-questions__header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    font-size: 12px;
    color: var(--text-secondary, #6b7280);
}

.related-questions__list {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.related-questions__item {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px;
    text-align: left;
    font-size: 14px;
    color: var(--text-secondary, #4b5563);
    background: none;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 150ms, color 150ms;
}

.related-questions__item:hover {
    background-color: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #111827);
}

.related-questions__icon {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--text-tertiary, #9ca3af);
    transition: color 150ms;
}

.related-questions__item:hover .related-questions__icon {
    color: var(--color-blue-500, #3b82f6);
}

.related-questions__text {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

/* Skeleton loading */
.related-questions__skeleton {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.related-questions__skeleton-item {
    height: 24px;
    border-radius: 4px;
    background-color: var(--bg-skeleton, #f3f4f6);
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
    .related-questions {
        border-color: var(--border-color-dark, #374151);
    }
    
    .related-questions__header {
        color: var(--text-secondary-dark, #9ca3af);
    }
    
    .related-questions__item {
        color: var(--text-secondary-dark, #d1d5db);
    }
    
    .related-questions__item:hover {
        background-color: var(--bg-hover-dark, #1f2937);
        color: var(--text-primary-dark, #ffffff);
    }
    
    .related-questions__skeleton-item {
        background-color: var(--bg-skeleton-dark, #1f2937);
    }
}
```

---

#### File: `src/components/features/chat/components/RelatedQuestions.tsx`

```tsx
import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import '@/styles/features/related-questions.css';

export interface RelatedQuestion {
    /** The follow-up question text */
    query: string;
    /** Optional unique identifier */
    id?: string;
}

export interface RelatedQuestionsProps {
    /** Array of related questions */
    questions: RelatedQuestion[];
    /** Callback when a question is selected */
    onSelect: (query: string) => void;
    /** Whether questions are loading */
    isLoading?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Displays AI-generated follow-up questions.
 * Compact list format optimized for sidepanel width.
 */
export const RelatedQuestions: React.FC<RelatedQuestionsProps> = ({
    questions,
    onSelect,
    isLoading = false,
    className,
}) => {
    // Don't render if no questions and not loading
    if (questions.length === 0 && !isLoading) return null;

    const containerClasses = ['related-questions', className].filter(Boolean).join(' ');

    // Show skeleton while loading
    if (isLoading) {
        return (
            <div className={containerClasses}>
                <div className="related-questions__header">
                    <Sparkles size={12} />
                    <span>Related</span>
                </div>
                <div className="related-questions__skeleton">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="related-questions__skeleton-item"
                            style={{ width: `${70 + Math.random() * 20}%` }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    // Filter out empty questions and limit to 3
    const validQuestions = questions
        .filter((q) => q.query && q.query.trim().length > 0)
        .slice(0, 3);

    if (validQuestions.length === 0) return null;

    return (
        <div className={containerClasses}>
            <div className="related-questions__header">
                <Sparkles size={12} />
                <span>Related</span>
            </div>
            
            <div className="related-questions__list">
                {validQuestions.map((question, index) => (
                    <button
                        key={question.id || index}
                        type="button"
                        onClick={() => onSelect(question.query)}
                        className="related-questions__item"
                    >
                        <ArrowRight size={14} className="related-questions__icon" />
                        <span className="related-questions__text">{question.query}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default RelatedQuestions;
```

---

#### File: `src/ai/agents/generateRelatedQuestions.ts`

```typescript
import { createLogger } from '~logger';
import type { CoreMessage } from 'ai';

const log = createLogger('GenerateRelatedQuestions', 'AI');

export interface RelatedQuestionsResult {
    questions: Array<{ query: string }>;
}

/**
 * System prompt for generating related questions.
 * Instructs the AI to create follow-up questions based on the conversation.
 */
const RELATED_QUESTIONS_PROMPT = `You are a helpful assistant that generates follow-up questions.
Based on the conversation, generate exactly 3 related questions that the user might want to ask next.

Requirements:
- Questions should explore the topic deeper or cover related aspects
- Keep questions concise (under 60 characters when possible)
- Questions should be naturally phrased, as if a user would ask them
- Match the language of the conversation

Respond with a JSON object in this exact format:
{
  "questions": [
    { "query": "First follow-up question?" },
    { "query": "Second follow-up question?" },
    { "query": "Third follow-up question?" }
  ]
}`;

/**
 * Generates related follow-up questions based on conversation context.
 * Uses a simple prompt-based approach that works with any model.
 * 
 * @param messages - Recent conversation messages
 * @param generateResponse - Function to generate AI response
 * @returns Array of related questions
 */
export async function generateRelatedQuestions(
    messages: CoreMessage[],
    generateResponse: (prompt: string) => Promise<string>
): Promise<RelatedQuestionsResult> {
    try {
        // Take last 3 messages for context
        const recentMessages = messages.slice(-3);
        const context = recentMessages
            .map((m) => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
            .join('\n');

        const prompt = `${RELATED_QUESTIONS_PROMPT}\n\nConversation:\n${context}`;
        
        const response = await generateResponse(prompt);
        
        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            log.warn('No JSON found in response');
            return { questions: [] };
        }

        const parsed = JSON.parse(jsonMatch[0]) as RelatedQuestionsResult;
        
        // Validate structure
        if (!Array.isArray(parsed.questions)) {
            log.warn('Invalid questions format');
            return { questions: [] };
        }

        log.debug('Generated related questions', { count: parsed.questions.length });
        return parsed;
    } catch (error) {
        log.error('Failed to generate related questions', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return { questions: [] };
    }
}
```

---

## Phase 8: Testing & Polish

### 8.1 Error Handling
**Goal:** Graceful error handling with user-friendly messages

---

#### File: `src/search/errors.ts`

```typescript
import { createLogger } from '~logger';

const log = createLogger('SearchErrors', 'SEARCH');

/** Search-specific error types */
export type SearchErrorCode =
    | 'NO_API_KEY'
    | 'INVALID_API_KEY'
    | 'RATE_LIMITED'
    | 'NETWORK_ERROR'
    | 'PROVIDER_ERROR'
    | 'TIMEOUT'
    | 'INVALID_QUERY'
    | 'UNKNOWN';

/** Search error with user-friendly message */
export class SearchError extends Error {
    code: SearchErrorCode;
    userMessage: string;
    retryable: boolean;
    retryAfter?: number; // seconds

    constructor(
        code: SearchErrorCode,
        message: string,
        userMessage: string,
        retryable: boolean = false,
        retryAfter?: number
    ) {
        super(message);
        this.name = 'SearchError';
        this.code = code;
        this.userMessage = userMessage;
        this.retryable = retryable;
        this.retryAfter = retryAfter;
    }
}

/** Error messages for each error code */
const ERROR_MESSAGES: Record<SearchErrorCode, { user: string; technical: string }> = {
    NO_API_KEY: {
        user: 'Web search is not configured. Please add your API key in Settings.',
        technical: 'No API key configured for search provider',
    },
    INVALID_API_KEY: {
        user: 'Your search API key is invalid. Please check Settings.',
        technical: 'API key rejected by provider',
    },
    RATE_LIMITED: {
        user: 'Search limit reached. Please wait a moment and try again.',
        technical: 'Rate limit exceeded',
    },
    NETWORK_ERROR: {
        user: 'Unable to connect to search service. Check your internet connection.',
        technical: 'Network request failed',
    },
    PROVIDER_ERROR: {
        user: 'Search service temporarily unavailable. Please try again.',
        technical: 'Provider returned an error',
    },
    TIMEOUT: {
        user: 'Search took too long. Please try a simpler query.',
        technical: 'Request timed out',
    },
    INVALID_QUERY: {
        user: 'Please enter a valid search query.',
        technical: 'Query validation failed',
    },
    UNKNOWN: {
        user: 'Something went wrong with the search. Please try again.',
        technical: 'Unknown error occurred',
    },
};

/**
 * Creates a SearchError from an HTTP response.
 */
export function createSearchErrorFromResponse(
    status: number,
    statusText: string,
    body?: string
): SearchError {
    let code: SearchErrorCode;
    let retryable = false;
    let retryAfter: number | undefined;

    switch (status) {
        case 401:
        case 403:
            code = 'INVALID_API_KEY';
            break;
        case 429:
            code = 'RATE_LIMITED';
            retryable = true;
            // Try to parse retry-after header or default to 60 seconds
            retryAfter = 60;
            break;
        case 400:
            code = 'INVALID_QUERY';
            break;
        case 500:
        case 502:
        case 503:
        case 504:
            code = 'PROVIDER_ERROR';
            retryable = true;
            break;
        default:
            code = 'UNKNOWN';
    }

    const messages = ERROR_MESSAGES[code];
    const technicalMessage = body 
        ? `${messages.technical}: ${status} ${statusText} - ${body}`
        : `${messages.technical}: ${status} ${statusText}`;

    log.error('Search API error', { code, status, statusText });

    return new SearchError(code, technicalMessage, messages.user, retryable, retryAfter);
}

/**
 * Creates a SearchError from a caught exception.
 */
export function createSearchErrorFromException(error: unknown): SearchError {
    if (error instanceof SearchError) {
        return error;
    }

    let code: SearchErrorCode = 'UNKNOWN';
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
        code = 'NETWORK_ERROR';
    } else if (error instanceof DOMException && error.name === 'AbortError') {
        code = 'TIMEOUT';
    }

    const messages = ERROR_MESSAGES[code];
    const technicalMessage = error instanceof Error ? error.message : 'Unknown error';

    log.error('Search exception', { code, error: technicalMessage });

    return new SearchError(
        code,
        technicalMessage,
        messages.user,
        code === 'NETWORK_ERROR' || code === 'TIMEOUT'
    );
}

/**
 * Gets user-friendly error message for display.
 */
export function getSearchErrorMessage(error: unknown): string {
    if (error instanceof SearchError) {
        return error.userMessage;
    }
    return ERROR_MESSAGES.UNKNOWN.user;
}
```

---

### 8.2 Result Caching
**Goal:** Cache search results to reduce API calls and improve performance

---

#### File: `src/search/cache.ts`

```typescript
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
```

---

### 8.3 Accessibility Utilities
**Goal:** Ensure search components are accessible

---

#### File: `src/search/a11y.ts`

```typescript
/**
 * Accessibility utilities for search components.
 */

/**
 * Announces a message to screen readers.
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.style.cssText = `
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    `;
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}

/**
 * Focus trap for modal dialogs.
 */
export function createFocusTrap(container: HTMLElement): {
    activate: () => void;
    deactivate: () => void;
} {
    const focusableSelector = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    let previouslyFocused: HTMLElement | null = null;

    function getFocusableElements(): HTMLElement[] {
        return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
    }

    function handleKeyDown(e: KeyboardEvent): void {
        if (e.key !== 'Tab') return;

        const focusable = getFocusableElements();
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    return {
        activate() {
            previouslyFocused = document.activeElement as HTMLElement;
            container.addEventListener('keydown', handleKeyDown);
            
            const focusable = getFocusableElements();
            if (focusable.length > 0) {
                focusable[0].focus();
            }
        },
        deactivate() {
            container.removeEventListener('keydown', handleKeyDown);
            previouslyFocused?.focus();
        },
    };
}

/**
 * Keyboard navigation for lists.
 */
export function handleListKeyNavigation(
    event: React.KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    onSelect: (index: number) => void
): void {
    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            if (currentIndex < items.length - 1) {
                onSelect(currentIndex + 1);
                items[currentIndex + 1]?.focus();
            }
            break;
        case 'ArrowUp':
            event.preventDefault();
            if (currentIndex > 0) {
                onSelect(currentIndex - 1);
                items[currentIndex - 1]?.focus();
            }
            break;
        case 'Home':
            event.preventDefault();
            onSelect(0);
            items[0]?.focus();
            break;
        case 'End':
            event.preventDefault();
            onSelect(items.length - 1);
            items[items.length - 1]?.focus();
            break;
    }
}
```

---

### 8.4 Integration Tests Checklist
**Goal:** Comprehensive testing of search functionality

---

#### Manual Testing Checklist

```markdown
## Search Feature Testing Checklist

### API Key Configuration
- [ ] No API key: Shows "Not configured" in settings
- [ ] Invalid API key: Test button shows error
- [ ] Valid API key: Test button shows success
- [ ] API key persists after extension restart

### Search Toggle
- [ ] Toggle appears in composer when API key configured
- [ ] Toggle disabled when no API key
- [ ] Toggle state persists across sessions
- [ ] Depth selector appears when search enabled
- [ ] Depth selector hidden when search disabled

### Search Execution
- [ ] Basic search returns results
- [ ] Advanced search returns more detailed results
- [ ] Empty query shows appropriate message
- [ ] Network error shows user-friendly message
- [ ] Rate limit error shows retry message
- [ ] Results cached (second identical query is instant)

### Results Display
- [ ] Results show in collapsible section
- [ ] Header shows query and result count
- [ ] Each result shows favicon, title, snippet
- [ ] Clicking result opens URL in new tab
- [ ] Images display when available
- [ ] "View more" expands full results list

### Citations
- [ ] Citation numbers appear inline in response
- [ ] Hover shows source preview
- [ ] Click opens source URL
- [ ] Citation list shows at end of response

### Related Questions
- [ ] Related questions appear after response
- [ ] Clicking question submits it as new query
- [ ] Questions are contextually relevant

### Sidepanel Layout
- [ ] All components fit within ~400px width
- [ ] Text truncates appropriately
- [ ] Scroll works for long result lists
- [ ] No horizontal overflow

### Accessibility
- [ ] All buttons have aria-labels
- [ ] Keyboard navigation works
- [ ] Screen reader announces search status
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA

### Performance
- [ ] Search completes in < 3 seconds (basic)
- [ ] UI remains responsive during search
- [ ] No memory leaks after multiple searches
- [ ] Cache reduces duplicate API calls
```

---

#### File: `src/search/__tests__/searchIntegration.test.ts`

```typescript
/**
 * Integration tests for search functionality.
 * Run with: pnpm test src/search/__tests__/searchIntegration.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TavilySearchProvider } from '../providers/tavily';
import { getCachedResults, setCachedResults, clearSearchCache } from '../cache';
import { SearchError, createSearchErrorFromResponse } from '../errors';

// Mock chrome.storage
const mockStorage: Record<string, unknown> = {};
vi.mock('chrome', () => ({
    storage: {
        local: {
            get: vi.fn((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
            set: vi.fn((obj: Record<string, unknown>) => {
                Object.assign(mockStorage, obj);
                return Promise.resolve();
            }),
            remove: vi.fn((key: string) => {
                delete mockStorage[key];
                return Promise.resolve();
            }),
        },
    },
}));

describe('Search Provider', () => {
    describe('TavilySearchProvider', () => {
        it('should validate API key is required', async () => {
            const provider = new TavilySearchProvider('');
            const results = await provider.search('test', 5, 'basic', [], []);
            expect(results.results).toHaveLength(0);
        });

        it('should sanitize URLs in results', () => {
            const provider = new TavilySearchProvider('test-key');
            const sanitized = (provider as any).sanitizeUrl(
                'https://example.com/page?utm_source=test&utm_medium=email&id=123'
            );
            expect(sanitized).toBe('https://example.com/page?id=123');
        });
    });
});

describe('Search Cache', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    });

    it('should cache and retrieve results', async () => {
        const results = {
            query: 'test',
            results: [{ title: 'Test', url: 'https://test.com', content: 'Content' }],
            images: [],
        };

        await setCachedResults('test', 'tavily', 'basic', results);
        const cached = await getCachedResults('test', 'tavily', 'basic');

        expect(cached).not.toBeNull();
        expect(cached?.query).toBe('test');
    });

    it('should return null for expired cache', async () => {
        const results = {
            query: 'test',
            results: [],
            images: [],
        };

        await setCachedResults('test', 'tavily', 'basic', results);
        
        // Get with very short TTL (already expired)
        const cached = await getCachedResults('test', 'tavily', 'basic', 0);
        expect(cached).toBeNull();
    });

    it('should clear cache', async () => {
        const results = { query: 'test', results: [], images: [] };
        await setCachedResults('test', 'tavily', 'basic', results);
        await clearSearchCache();
        
        const cached = await getCachedResults('test', 'tavily', 'basic');
        expect(cached).toBeNull();
    });
});

describe('Search Errors', () => {
    it('should create error from 401 response', () => {
        const error = createSearchErrorFromResponse(401, 'Unauthorized');
        expect(error.code).toBe('INVALID_API_KEY');
        expect(error.retryable).toBe(false);
    });

    it('should create error from 429 response', () => {
        const error = createSearchErrorFromResponse(429, 'Too Many Requests');
        expect(error.code).toBe('RATE_LIMITED');
        expect(error.retryable).toBe(true);
        expect(error.retryAfter).toBeDefined();
    });

    it('should create error from 500 response', () => {
        const error = createSearchErrorFromResponse(500, 'Internal Server Error');
        expect(error.code).toBe('PROVIDER_ERROR');
        expect(error.retryable).toBe(true);
    });

    it('should have user-friendly messages', () => {
        const error = new SearchError(
            'NO_API_KEY',
            'Technical message',
            'User message',
            false
        );
        expect(error.userMessage).toBe('User message');
        expect(error.message).toBe('Technical message');
    });
});
```

---

## Implementation Priority & Dependencies

```
Phase 1 ─────► Phase 2 ─────► Phase 5
    │              │              │
    ▼              ▼              ▼
Phase 6        Phase 3        Phase 7
                   │
                   ▼
               Phase 4
                   │
                   ▼
               Phase 8
```

**Recommended Order:**
1. **Phase 1** → Core infrastructure (required for everything)
2. **Phase 2** → Tool registration (enables AI usage)
3. **Phase 3** → Composer UI (user interaction)
4. **Phase 4** → Results display (complete user experience)
5. **Phase 5** → Agent integration (AI behavior)
6. **Phase 6** → Settings (configuration)
7. **Phase 7** → Polish features (enhanced UX)
8. **Phase 8** → Testing & polish

---

## Key Files Summary

### New Files to Create:

| Directory/File | Purpose |
|----------------|--------|
| **Search Infrastructure** | |
| `src/search/types.ts` | Search result types and interfaces |
| `src/search/schema.ts` | Zod schemas for tool parameters |
| `src/search/errors.ts` | Error handling utilities |
| `src/search/cache.ts` | Result caching with TTL |
| `src/search/a11y.ts` | Accessibility utilities |
| `src/search/providers/base.ts` | Base provider class |
| `src/search/providers/tavily.ts` | Tavily API implementation |
| `src/search/providers/index.ts` | Provider factory |
| `src/search/index.ts` | Main exports |
| **Tools** | |
| `src/actions/search/useWebSearch.tsx` | Web search tool hook |
| `src/actions/search/useRetrieve.tsx` | URL retrieve tool hook |
| `src/actions/search/index.ts` | Tool exports |
| **Hooks** | |
| `src/hooks/useSearchMode.ts` | Search mode state management |
| **Settings** | |
| `src/utils/settings/searchSettings.ts` | Settings storage |
| **UI Components** | |
| `src/components/features/chat/components/SearchModeToggle.tsx` | Toggle button |
| `src/components/features/chat/components/SearchDepthSelector.tsx` | Depth dropdown |
| `src/components/features/chat/components/SearchControls.tsx` | Combined controls |
| `src/components/features/chat/components/SearchSection.tsx` | Results container |
| `src/components/features/chat/components/SearchResults.tsx` | Results grid/list |
| `src/components/features/chat/components/SearchResultsImageSection.tsx` | Image results |
| `src/components/features/chat/components/RetrieveSection.tsx` | URL retrieve display |
| `src/components/features/chat/components/SourceCitation.tsx` | Inline citation |
| `src/components/features/chat/components/CitationList.tsx` | Source list |
| `src/components/features/chat/components/RelatedQuestions.tsx` | Follow-up questions |
| `src/components/features/settings/components/SearchSettingsSection.tsx` | Settings UI |
| **AI** | |
| `src/ai/agents/generateRelatedQuestions.ts` | Related questions generation |

### Existing Files to Modify:

| File | Changes |
|------|--------|
| `src/components/features/chat/components/Composer.tsx` | Add `<SearchControls />` |
| `src/actions/registerAll.ts` | Add `useWebSearch()` and `useRetrieve()` |
| `src/utils/settings/index.ts` | Export search settings |
| `src/components/features/settings/SettingsPage.tsx` | Add `<SearchSettingsSection />` |

---

## Estimated Effort

| Phase | Estimated Time | Complexity |
|-------|---------------|------------|
| Phase 1 | 2-3 days | Medium |
| Phase 2 | 1-2 days | Medium |
| Phase 3 | 1-2 days | Low |
| Phase 4 | 2-3 days | Medium |
| Phase 5 | 1 day | Low |
| Phase 6 | 1 day | Low |
| Phase 7 | 1-2 days | Medium |
| Phase 8 | 1-2 days | Low |

**Total: 10-17 days of development**

---

## Technical Considerations

### 1. API Key Security
- Store search API keys in Chrome's local storage (separate key from settings)
- Never log or expose API keys
- Validate keys before making requests

### 2. Rate Limiting
- Implement client-side debouncing (300ms) on search triggers
- Show user-friendly "Rate limited" message with retry countdown
- Cache results to reduce duplicate API calls

### 3. Caching Strategy
- Use Chrome storage for caching search results
- Cache key format: `${query.toLowerCase()}:${provider}:${depth}`
- Default TTL: 1 hour
- Maximum 50 cached entries (LRU eviction)

### 4. Bundle Size
- Search provider code is lightweight (~5KB)
- UI components use existing shared components
- No additional dependencies required

### 5. CORS Handling
- Tavily API supports CORS from browser extensions
- Jina Reader API (for retrieve) also supports CORS
- No background service worker proxy needed

### 6. Context Window Management
- Limit content per search result to 500 characters
- Maximum 10 results by default
- Truncate long titles to 100 characters
- Total search context typically ~3-5K tokens

### 7. Sidepanel UI Constraints
- Maximum width ~400px
- Use vertical layouts over horizontal
- Collapse sections by default to save space
- Small icons (14-16px), compact spacing (4-8px)
- Truncate text with ellipsis, show full on hover

---

## Success Criteria

- [ ] User can toggle search mode on/off from composer
- [ ] User can select search depth (basic/advanced)
- [ ] AI uses search tool when search mode is enabled
- [ ] Search results display in collapsible sections
- [ ] Results show favicon, title, snippet, source
- [ ] Citations appear inline in AI responses with tooltips
- [ ] Citation list appears at end of responses
- [ ] Related questions appear after AI responses
- [ ] Settings allow API key configuration with test button
- [ ] Errors show user-friendly messages with retry option
- [ ] Results are cached to avoid duplicate API calls
- [ ] Performance is acceptable (< 3s for basic search)
- [ ] All components work in sidepanel dimensions (~400px)
- [ ] Keyboard navigation works for all interactive elements
- [ ] Screen readers can navigate search results
