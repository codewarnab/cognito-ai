/**
 * Rewriter Module
 * Exports all rewriter-related functionality
 * 
 * This module provides text rewriting capabilities using various AI providers.
 * It supports multiple providers (OpenAI, Anthropic, xAI, Gemini/Vertex) and
 * features like AI-driven memory search, web search, and URL context fetching.
 */

// Primary exports (new names)
export { rewriter, Rewriter } from './rewriter';
export type { RewriterOptions } from './types';

// Backward compatibility aliases
export { geminiRewriter, GeminiRewriter } from './rewriter';

// Handler export
export { handleRewriteRequest } from './handler';

// Backend rewriter exports
export { rewriteWithBackend } from './backendRewriter';
export type { BackendRewriteOptions, BackendRewriteResult } from './backendRewriter';

// Types re-export
export type { ProviderConfig, MemorySearchResult } from './types';
export { REWRITER_CONSTANTS } from './types';

// Prompts utilities (for advanced use cases)
export {
    REWRITER_SYSTEM_PROMPT,
    buildRewriteInstruction,
    buildUserPrompt,
    calculateMaxTokens
} from './prompts';
