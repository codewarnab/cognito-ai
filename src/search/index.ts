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

// Errors
export {
    SearchError,
    createSearchErrorFromResponse,
    createSearchErrorFromException,
    getSearchErrorMessage,
} from './errors';
export type { SearchErrorCode } from './errors';

// Cache
export {
    getCachedResults,
    setCachedResults,
    clearSearchCache,
    getCacheStats,
} from './cache';

// Accessibility
export {
    announceToScreenReader,
    createFocusTrap,
    handleListKeyNavigation,
} from './a11y';
