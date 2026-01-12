/**
 * Rewriter Class
 * Main orchestrator for text rewriting using various AI providers
 * Routes requests to the appropriate provider-specific implementation
 */

import { getActiveProvider } from '@/utils/credentials';
import { createLogger } from '~logger';
import { buildRewriteInstruction, buildUserPrompt } from './prompts';
import { rewriteWithOpenAI, rewriteWithAnthropic, rewriteWithXAI, rewriteWithGemini } from './providers';
import type { RewriterOptions } from './types';

const log = createLogger('Rewriter', 'BACKGROUND');

/**
 * Rewriter class
 * Provides a unified interface for text rewriting across multiple AI providers
 * 
 * Features:
 * - Multi-provider support (OpenAI, Anthropic/Claude, xAI, Gemini/Vertex)
 * - Preset-based or custom instruction rewriting
 * - Optional AI-driven memory search via function calling
 * - Web search integration (provider-dependent)
 * - URL context fetching (Gemini and Claude only)
 */
export class Rewriter {
    /**
     * Rewrite text using the currently active AI provider
     * Non-streaming implementation with optional tool/function calling support
     * 
     * @param text - The text to rewrite
     * @param options - Rewrite options including preset, instruction, and tool configurations
     * @returns The rewritten text
     * @throws Error if no provider is configured or API call fails
     */
    async rewrite(text: string, options: RewriterOptions = {}): Promise<string> {
        const { preset, instruction, enableUrlContext, enableGoogleSearch, enableSupermemorySearch } = options;

        // Build the instruction prompt
        const rewriteInstruction = buildRewriteInstruction(preset, instruction);
        const prompt = buildUserPrompt(text, rewriteInstruction);

        // Get the active provider
        const activeProvider = await getActiveProvider();

        // Route to the appropriate provider implementation
        const providerOptions = {
            enableUrlContext,
            enableGoogleSearch,
            enableSupermemorySearch,
            preset,
        };

        log.debug('Routing rewrite request', {
            provider: activeProvider,
            textLength: text.length,
            preset,
            hasInstruction: !!instruction,
        });

        switch (activeProvider) {
            case 'openai':
                return rewriteWithOpenAI(text, prompt, providerOptions);

            case 'anthropic':
                return rewriteWithAnthropic(text, prompt, providerOptions);

            case 'xai':
                return rewriteWithXAI(text, prompt, providerOptions);

            // Default to Gemini/Vertex (includes 'gemini', 'vertex', and any other provider)
            default:
                return rewriteWithGemini(text, prompt, providerOptions);
        }
    }
}

// Export singleton instance
export const rewriter = new Rewriter();

// Backward compatibility aliases
export const geminiRewriter = rewriter;
export const GeminiRewriter = Rewriter;
