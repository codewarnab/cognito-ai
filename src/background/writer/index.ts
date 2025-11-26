/**
 * Writer Module
 * Exports all writer-related functionality
 */

export { geminiWriter, GeminiWriter } from './geminiWriter';
export type { WriterOptions } from './geminiWriter';
export { handleWriteGenerateStreaming } from './handler';
export {
    detectPlatform,
    extractDomain,
    buildPageContext,
    buildContextString,
    getSuggestedTone,
} from './contextBuilder';
export type { PlatformInfo } from './contextBuilder';

// Stream parser exports
export {
    parseGeminiSSE,
    parseGeminiSSEWithMetadata,
    parseSSELine,
    collectGeminiSSE,
} from './streamParser';
export type { ParsedChunk } from './streamParser';
