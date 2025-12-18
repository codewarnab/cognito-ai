/**
 * Writer Module
 * Exports all writer-related functionality
 */

export { geminiWriter, GeminiWriter } from './geminiWriter';
export type { WriterOptions } from './geminiWriter';
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
