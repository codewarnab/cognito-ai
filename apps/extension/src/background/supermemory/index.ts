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

// Function calling exports for AI-driven memory search
export {
    MEMORY_SEARCH_FUNCTION,
    parseMemorySearchParams,
    type MemorySearchFunctionParams,
    // OpenAI format
    MEMORY_SEARCH_OPENAI_TOOL,
    getMemorySearchToolOpenAI,
    // Claude format
    MEMORY_SEARCH_CLAUDE_TOOL,
    getMemorySearchToolClaude,
} from './functionDeclaration';

export {
    // Gemini handlers
    hasFunctionCall,
    extractFunctionCall,
    executeMemorySearch,
    buildFunctionResponseContent,
    getMemorySearchTool,
    type GeminiFunctionCall,
    type GeminiContentPart,
    // OpenAI handlers
    hasOpenAIToolCall,
    extractOpenAIToolCall,
    executeOpenAIMemorySearch,
    buildOpenAIToolResponse,
    type OpenAIToolCall,
    // Claude handlers
    hasClaudeToolUse,
    extractClaudeToolUse,
    executeClaudeMemorySearch,
    buildClaudeToolResult,
    type ClaudeToolUse,
    type ClaudeContentBlock,
} from './functionHandler';
