/**
 * Summarizer Module
 * Exports all summarizer-related functionality
 */

export { geminiSummarizer, GeminiSummarizer } from './geminiSummarizer';
export type { SummarizerOptions } from './geminiSummarizer';
export { handleSummarizeRequest } from './handler';
export { generateVertexAccessToken } from './vertexAuth';
