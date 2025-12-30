/**
 * Search types (extension)
 *
 * Canonical web-search request/response types live in `@cognito/shared` so both the
 * extension and backend agree on a single contract.
 *
 * This file re-exports those shared types while preserving the extension's existing
 * naming (`SearchResults`, `SearchResultItem`, etc.) and import path (`@/search/types`).
 */

export type {
    SearchDepth,
    SearchProviderType,
    SearchResult as SearchResultItem,
    SearchImage as SearchResultImage,
    WebSearchRequestBody,
    WebSearchResponse,
} from '@cognito/shared';

/**
 * Generic results shape used across the extension's search + retrieve tools.
 *
 * - Web search returns `number_of_results`
 * - Retrieve does not, so it's optional here.
 */
export type SearchResults = Omit<import('@cognito/shared').WebSearchResponse, 'number_of_results'> & {
    number_of_results?: number;
};

/** Default search provider */
export const DEFAULT_SEARCH_PROVIDER: import('@cognito/shared').SearchProviderType = 'tavily';
