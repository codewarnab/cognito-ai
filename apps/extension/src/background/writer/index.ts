/**
 * Writer Module
 * Exports all writer-related functionality
 */

// Primary exports (new names)
export { writer, Writer } from './writer';
export type { WriterOptions } from './writer';

// Backward compatibility aliases
export { geminiWriter, GeminiWriter } from './writer';

export { handleWriteGenerate } from './handler';
export {
    detectPlatform,
    extractDomain,
    buildPageContext,
    buildContextString,
    getSuggestedTone,
} from './contextBuilder';
export type { PlatformInfo } from './contextBuilder';

// Backend writer exports
export { generateWithBackend, generateTextWithBackend } from './backendWriter';
export type { BackendWriteOptions } from './backendWriter';

// Stream parser exports
export {
    parseGeminiSSE,
    parseGeminiSSEWithMetadata,
    parseSSELine,
    collectGeminiSSE,
} from './streamParser';
export type { ParsedChunk } from './streamParser';
