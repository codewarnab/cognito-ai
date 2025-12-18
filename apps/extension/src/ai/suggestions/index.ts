/**
 * Suggestions Module
 * Exports suggestion generation functionality for local, remote, and backend modes
 */

// Local suggestion generation
export { generateLocalContextualSuggestions, type Suggestion } from './local';

// Main suggestion generator (supports local, remote, and backend)
export { generateContextualSuggestions } from './generator';

// Backend suggestion generation
export { generateBackendSuggestions } from './backendSuggestions';
export type { BackendSuggestionsResult } from './backendSuggestions';
