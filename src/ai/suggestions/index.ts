/**
 * Suggestions Module
 * Exports suggestion generation functionality for both local and remote modes
 */

// Local suggestion generation
export { generateLocalContextualSuggestions, type Suggestion } from './local';

// Main suggestion generator (supports both local and remote)
export { generateContextualSuggestions } from './generator';
