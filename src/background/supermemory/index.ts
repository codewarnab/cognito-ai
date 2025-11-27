/**
 * Supermemory Background Services
 * Exports search service functionality for Writer and Rewriter features
 */
export {
    searchMemories,
    formatMemoriesForPrompt,
    isMemorySearchAvailable,
    type MemorySearchResult,
    type SearchMemoriesOptions,
    type SearchMemoriesResponse
} from './searchService';

// Function calling exports (Phase 6 - AI-driven memory search)
export {
    MEMORY_SEARCH_FUNCTION,
    parseMemorySearchParams,
    type MemorySearchFunctionParams,
} from './functionDeclaration';

export {
    hasFunctionCall,
    extractFunctionCall,
    executeMemorySearch,
    buildFunctionResponseContent,
    getMemorySearchTool,
    type GeminiFunctionCall,
    type GeminiContentPart,
} from './functionHandler';
