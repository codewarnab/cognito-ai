/**
 * @cognito/shared - Web Search Types
 *
 * Canonical request/response shapes for Cognito's web search features.
 *
 * Notes:
 * - Used by both the Chrome extension and the Vercel backend.
 * - Field names intentionally use snake_case to match the JSON wire format.
 */

import type { SearchDepth } from './settings.js';

/**
 * Request body for performing a web search (Tavily-backed).
 */
export interface WebSearchRequestBody {
    /** The search query text. */
    query: string;
    /** Maximum number of results to return (provider may clamp this). */
    max_results?: number;
    /** Search depth: 'basic' is faster, 'advanced' is more thorough. */
    search_depth?: SearchDepth;
    /** Domains to prioritize/include (optional). */
    include_domains?: string[];
    /** Domains to exclude (optional). */
    exclude_domains?: string[];
}

/**
 * A single text result from a web search.
 */
export interface SearchResult {
    /** Page title. */
    title: string;
    /** Canonical URL for the result. */
    url: string;
    /** Short content snippet/summary extracted from the page. */
    content: string;
}

/**
 * An image result returned alongside text results.
 *
 * Some providers may omit descriptions; consumers should treat empty string
 * (`description: ''`) as "no description available".
 */
export interface SearchImage {
    /** Image URL. */
    url: string;
    /** Description/alt text when available (may be empty string). */
    description: string;
}

/**
 * Response payload returned from the backend `/web-search` endpoint.
 */
export interface WebSearchResponse {
    /** Text/link results. */
    results: SearchResult[];
    /** Image results (if enabled). */
    images: SearchImage[];
    /** The final query that was executed (may be padded/normalized by provider). */
    query: string;
    /** Number of results returned (after any filtering/deduping). */
    number_of_results: number;
}


