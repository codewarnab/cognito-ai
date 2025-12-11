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
