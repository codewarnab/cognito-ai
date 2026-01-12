/**
 * Generation Module
 * 
 * Exports provider-specific generation functions for the writer.
 * Each provider has its own implementation to handle API differences
 * and provider-specific features.
 * 
 * @module writer/generation
 */

// OpenAI generation
export { generateWithOpenAI, streamWithOpenAI } from './openai';

// xAI generation
export { generateWithXAI, streamWithXAI } from './xai';

// Anthropic/Claude generation
export { generateWithAnthropic, streamWithAnthropic } from './anthropic';

// Gemini/Vertex generation
export { generateWithGemini, streamWithGemini } from './gemini';
