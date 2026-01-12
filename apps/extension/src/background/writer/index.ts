/**
 * Writer Module
 * 
 * Exports all writer-related functionality for text generation.
 * This module provides a unified interface for generating text across
 * multiple AI providers (Gemini, OpenAI, xAI, Claude).
 * 
 * @module writer
 * 
 * @example
 * ```typescript
 * import { writer, type WriterOptions } from '@/background/writer';
 * 
 * // Generate text
 * const text = await writer.generate("Write about AI", {
 *   tone: 'professional',
 *   enableGoogleSearch: true,
 * });
 * 
 * // Stream text
 * for await (const chunk of writer.generateStream("Tell a story")) {
 *   console.log(chunk);
 * }
 * ```
 */

// =============================================================================
// Core Writer Exports
// =============================================================================

/** Main writer instance and class */
export { writer, Writer, geminiWriter, GeminiWriter } from './core/writer';

/** Writer options type */
export type { WriterOptions } from './core/types';

// =============================================================================
// Core Types and Utilities
// =============================================================================

/**
 * Type definitions for writer module
 * @see {@link ./core/types}
 */
export type {
    AttachmentData,
    GeminiRequestPart,
    GeminiContentPart,
    OpenAIContentPart,
    AnthropicContentPart,
    OpenAIMessage,
    AnthropicMessage,
    AnthropicToolResult,
    GeminiMessage,
} from './core/types';

/** Generation constants */
export {
    MAX_FUNCTION_CALLS,
    DEFAULT_MAX_TOKENS,
    DEFAULT_TEMPERATURE,
    DEFAULT_TOP_P,
} from './core/types';

/** System prompt builders */
export {
    buildSystemPrompt,
    buildMemoryEnrichedPrompt,
} from './core/prompts';

// =============================================================================
// Content Builders
// =============================================================================

/**
 * Content builders for multimodal requests
 * @see {@link ./content-builders}
 */
export {
    buildGeminiRequestParts,
    buildOpenAIMessageContent,
    buildAnthropicMessageContent,
} from './content-builders';

// =============================================================================
// Provider-Specific Generation
// =============================================================================

/**
 * Provider-specific generation functions for advanced use cases.
 * Most users should use the main `writer` instance instead.
 * @see {@link ./generation}
 */
export {
    generateWithOpenAI,
    streamWithOpenAI,
    generateWithXAI,
    streamWithXAI,
    generateWithAnthropic,
    streamWithAnthropic,
    generateWithGemini,
    streamWithGemini,
} from './generation';

// =============================================================================
// Handler Exports
// =============================================================================

/** Message handler for write generation requests */
export { handleWriteGenerate } from './handler';

// =============================================================================
// Context Builder Exports
// =============================================================================

/**
 * Context builder utilities for platform detection and context extraction
 * @see {@link ./contextBuilder}
 */
export {
    detectPlatform,
    extractDomain,
    buildPageContext,
    buildContextString,
    getSuggestedTone,
} from './contextBuilder';
export type { PlatformInfo } from './contextBuilder';

// =============================================================================
// Backend Writer Exports
// =============================================================================

/**
 * Backend writer for server-side generation
 * @see {@link ./backendWriter}
 */
export { generateWithBackend, generateTextWithBackend } from './backendWriter';
export type { BackendWriteOptions } from './backendWriter';

// =============================================================================
// Stream Parser Exports
// =============================================================================

/**
 * SSE stream parsing utilities
 * @see {@link ./streamParser}
 */
export {
    parseGeminiSSE,
    parseGeminiSSEWithMetadata,
    parseSSELine,
    collectGeminiSSE,
} from './streamParser';
export type { ParsedChunk } from './streamParser';
