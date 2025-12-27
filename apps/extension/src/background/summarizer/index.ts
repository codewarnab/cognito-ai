/**
 * Summarizer Module
 * Exports all summarizer-related functionality
 */

// Primary exports (new names)
export { summarizer, Summarizer } from './summarizer';
export type { SummarizerOptions } from './summarizer';

// Backward compatibility aliases
export { geminiSummarizer, GeminiSummarizer } from './summarizer';

export { handleSummarizeRequest } from './handler';
export { generateVertexAccessToken } from './vertexAuth';

// Backend summarizer exports
export { summarizeWithBackend, summarizeTextWithBackend } from './backendSummarizer';
export type { BackendSummarizeOptions } from './backendSummarizer';
