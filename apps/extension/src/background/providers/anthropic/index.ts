/**
 * Anthropic Provider Module Index
 * Re-exports all Anthropic-specific functionality
 */

export {
    searchWithAnthropic,
    isAnthropicWebSearchAvailable,
    formatAnthropicCitationsForPrompt,
    getWebSearchToolConfig,
    type AnthropicWebSearchResult,
    type AnthropicWebSearchOptions,
} from './webSearch';
