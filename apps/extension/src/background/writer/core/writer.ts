/**
 * Writer Client
 * 
 * Handles text generation using the modular provider architecture.
 * Supports Google AI, Vertex AI, OpenAI, xAI, and Claude providers.
 * 
 * This is the main entry point for text generation in the extension.
 * It delegates to provider-specific implementations while providing
 * a unified interface.
 * 
 * @module writer/writer
 * 
 * @example
 * ```typescript
 * import { writer } from './writer';
 * 
 * // Non-streaming generation
 * const text = await writer.generate("Write about AI", {
 *   tone: 'professional',
 *   enableGoogleSearch: true,
 * });
 * 
 * // Streaming generation
 * for await (const chunk of writer.generateStream("Tell a story")) {
 *   console.log(chunk);
 * }
 * ```
 */

import { getActiveProvider } from '@/utils/credentials';
import { createLogger } from '~logger';
import { streamWithProvider, generateWithProvider } from '../../providers';
import type { WriterOptions } from './types';
import { DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE, DEFAULT_TOP_P } from './types';
import { buildSystemPrompt } from './prompts';

// Provider-specific generation functions
import { generateWithOpenAI, streamWithOpenAI } from '../generation/openai';
import { generateWithXAI, streamWithXAI } from '../generation/xai';
import { generateWithAnthropic, streamWithAnthropic } from '../generation/anthropic';
import { generateWithGemini, streamWithGemini } from '../generation/gemini';

const log = createLogger('Writer', 'BACKGROUND');

/**
 * Writer class for unified text generation across providers.
 * 
 * Provides a single interface for text generation that automatically
 * routes to the appropriate provider based on user configuration.
 * 
 * Features:
 * - Multi-provider support (Gemini, OpenAI, xAI, Claude)
 * - Multimodal content (images, PDFs)
 * - Web search integration
 * - Memory search via AI-driven function calling
 * - Both streaming and non-streaming generation
 * 
 * @class Writer
 */
export class Writer {
    /**
     * Non-streaming text generation.
     * 
     * Generates complete text based on the prompt and options.
     * Automatically routes to the appropriate provider and handles
     * provider-specific features.
     * 
     * @param {string} prompt - The user prompt for generation
     * @param {WriterOptions} [options] - Generation options
     * @returns {Promise<string>} The generated text
     * 
     * @example
     * ```typescript
     * const text = await writer.generate("Write a professional email", {
     *   tone: 'professional',
     *   pageContext: {
     *     platform: 'Gmail',
     *     domain: 'mail.google.com'
     *   }
     * });
     * ```
     * 
     * @example
     * ```typescript
     * // With web search and memory
     * const text = await writer.generate("What's new in AI?", {
     *   enableGoogleSearch: true,
     *   enableSupermemorySearch: true,
     * });
     * ```
     * 
     * @example
     * ```typescript
     * // With image attachment
     * const text = await writer.generate("Describe this image", {
     *   attachment: {
     *     base64Data: imageBase64,
     *     mimeType: 'image/png',
     *     fileName: 'screenshot.png',
     *     fileSize: 1024
     *   }
     * });
     * ```
     */
    async generate(prompt: string, options?: WriterOptions): Promise<string> {
        const activeProvider = await getActiveProvider();
        const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS;

        // Check if advanced features are enabled
        const hasAdvancedFeatures = options?.enableUrlContext ||
            options?.enableGoogleSearch ||
            options?.enableSupermemorySearch ||
            options?.attachment;

        log.info('Starting generation', {
            provider: activeProvider,
            hasAdvancedFeatures,
            tone: options?.tone,
            platform: options?.pageContext?.platform,
        });

        // For simple generation without advanced features on OpenAI/xAI, use provider abstraction
        if (!hasAdvancedFeatures && (activeProvider === 'openai' || activeProvider === 'xai')) {
            log.info(`Using ${activeProvider} provider for simple generation`);
            const systemPrompt = buildSystemPrompt(options);
            return generateWithProvider(systemPrompt, prompt, {
                maxTokens,
                temperature: DEFAULT_TEMPERATURE,
                topP: DEFAULT_TOP_P,
            });
        }

        // Route to provider-specific implementation
        switch (activeProvider) {
            case 'openai':
                return generateWithOpenAI(prompt, options);

            case 'xai':
                return generateWithXAI(prompt, options);

            case 'anthropic':
                return generateWithAnthropic(prompt, options);

            case 'google':
            case 'vertex':
            default:
                return generateWithGemini(prompt, options);
        }
    }

    /**
     * Streaming text generation.
     * 
     * Generates text as an async generator, yielding chunks as they
     * are received from the API. Useful for real-time display of
     * generated content.
     * 
     * Note: For memory search (enableSupermemorySearch), tool calls
     * are handled in non-streaming mode before streaming the final
     * response. This is because tool call loops require synchronous handling.
     * 
     * @param {string} prompt - The user prompt for generation
     * @param {WriterOptions} [options] - Generation options
     * @yields {string} Text chunks as they are generated
     * 
     * @example
     * ```typescript
     * // Basic streaming
     * for await (const chunk of writer.generateStream("Tell me a story")) {
     *   process.stdout.write(chunk);
     * }
     * ```
     * 
     * @example
     * ```typescript
     * // Streaming with options
     * const stream = writer.generateStream("Write code", {
     *   tone: 'technical',
     *   maxTokens: 2048,
     * });
     * 
     * let fullText = '';
     * for await (const chunk of stream) {
     *   fullText += chunk;
     *   updateUI(fullText);
     * }
     * ```
     */
    async *generateStream(prompt: string, options?: WriterOptions): AsyncGenerator<string, void, unknown> {
        const activeProvider = await getActiveProvider();
        const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS;

        // Check if advanced features are enabled
        const hasAdvancedFeatures = options?.enableUrlContext ||
            options?.enableGoogleSearch ||
            options?.enableSupermemorySearch ||
            options?.attachment;

        log.info('Starting streaming generation', {
            provider: activeProvider,
            hasAdvancedFeatures,
            tone: options?.tone,
        });

        // For simple streaming without advanced features on OpenAI/xAI, use provider abstraction
        if (!hasAdvancedFeatures && (activeProvider === 'openai' || activeProvider === 'xai')) {
            log.info(`Using ${activeProvider} provider for simple streaming`);
            const systemPrompt = buildSystemPrompt(options);
            yield* streamWithProvider(systemPrompt, prompt, {
                maxTokens,
                temperature: DEFAULT_TEMPERATURE,
                topP: DEFAULT_TOP_P,
            });
            return;
        }

        // Route to provider-specific implementation
        switch (activeProvider) {
            case 'openai':
                yield* streamWithOpenAI(prompt, options);
                break;

            case 'xai':
                yield* streamWithXAI(prompt, options);
                break;

            case 'anthropic':
                yield* streamWithAnthropic(prompt, options);
                break;

            case 'google':
            case 'vertex':
            default:
                yield* streamWithGemini(prompt, options);
                break;
        }
    }
}

/**
 * Singleton instance of the Writer class.
 * Use this for all text generation operations.
 * 
 * @example
 * ```typescript
 * import { writer } from './writer';
 * 
 * const text = await writer.generate("Hello world");
 * ```
 */
export const writer = new Writer();

/**
 * Backward compatibility alias for geminiWriter.
 * @deprecated Use `writer` instead
 */
export const geminiWriter = writer;

/**
 * Backward compatibility alias for GeminiWriter class.
 * @deprecated Use `Writer` instead
 */
export const GeminiWriter = Writer;
