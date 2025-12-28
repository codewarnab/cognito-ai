/**
 * xAI Provider Module Index
 * Re-exports all xAI-specific functionality
 */

export {
    searchWithXai,
    isXaiWebSearchAvailable,
    formatXaiCitationsForPrompt,
    getXaiSearchParameters,
    type XaiWebSearchResult,
    type XaiWebSearchOptions,
    type XaiSearchParameters,
    type XaiSearchCitation,
} from './webSearch';
