/**
 * Gemini Rewriter Client
 * Non-streaming text rewriting using Gemini API with optional tools (URL Context, Google Search)
 * Supports AI-driven memory search via function calling (Phase 6)
 */

import {
    getGoogleApiKey,
    getVertexCredentials,
    hasGoogleApiKey,
    hasVertexCredentials,
} from '@/utils/credentials';
import { GEMINI_MODELS } from '~/constants';
import { createLogger } from '~logger';
import { generateVertexAccessToken } from '../summarizer/vertexAuth';
import {
    getMemorySearchTool,
    hasFunctionCall,
    extractFunctionCall,
    executeMemorySearch,
    type GeminiContentPart,
} from '../supermemory';
import { searchMemories, formatMemoriesForPrompt } from '../supermemory';
import type { RewritePreset } from '@/types';

const log = createLogger('GeminiRewriter', 'BACKGROUND');

/**
 * Preset-specific rewrite instructions
 */
const PRESET_PROMPTS: Record<RewritePreset, string> = {
    shorter: 'Make this text shorter and more concise while preserving the key meaning',
    longer: 'Expand this text with more detail and elaboration',
    professional: 'Rewrite this in a more professional and formal tone',
    casual: 'Rewrite this in a more casual and friendly tone',
    improve: 'Improve this text by fixing grammar, clarity, and flow',
    simplify: 'Simplify this text for easier understanding',
    enthusiastic: 'Rewrite this in a more enthusiastic and positive tone',
    conversational: 'Rewrite this in a more natural, conversational style',
};

/**
 * Options for text rewriting
 */
export interface RewriterOptions {
    preset?: RewritePreset;
    instruction?: string;
    enableUrlContext?: boolean;
    enableGoogleSearch?: boolean;
    // Phase 6: AI-driven memory search via function calling
    enableSupermemorySearch?: boolean;
}

/**
 * Provider configuration for API calls
 */
interface ProviderInfo {
    type: 'google' | 'vertex';
    url: string;
    headers: Record<string, string>;
}

export class GeminiRewriter {
    private model = GEMINI_MODELS.LITE;

    // Gemini API (Google AI) base URL
    private googleBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    // Vertex AI base URL template
    private vertexBaseUrlTemplate = 'https://{location}-aiplatform.googleapis.com/v1';

    /**
     * Get provider info for API calls
     * Priority: Google AI (API key) > Vertex AI (service account)
     */
    private async getProviderInfo(): Promise<ProviderInfo> {
        // Check Google AI first (preferred)
        if (await hasGoogleApiKey()) {
            const apiKey = await getGoogleApiKey();
            log.debug('Using Google AI (Gemini API) provider');
            return {
                type: 'google',
                url: `${this.googleBaseUrl}/models/${this.model}:generateContent?key=${apiKey}`,
                headers: {
                    'Content-Type': 'application/json',
                },
            };
        }

        // Fall back to Vertex AI
        if (await hasVertexCredentials()) {
            const credentials = await getVertexCredentials();
            if (!credentials) {
                throw new Error('Vertex credentials not found');
            }

            const accessToken = await generateVertexAccessToken(credentials);
            const vertexBaseUrl = this.vertexBaseUrlTemplate.replace('{location}', credentials.location);

            log.debug('Using Vertex AI provider', { location: credentials.location });
            return {
                type: 'vertex',
                url: `${vertexBaseUrl}/projects/${credentials.projectId}/locations/${credentials.location}/publishers/google/models/${this.model}:generateContent`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
            };
        }

        throw new Error('No AI provider configured. Please add your Google API key in settings.');
    }

    /**
     * Non-streaming rewrite generation
     * Uses single API call with optional Gemini tools
     * Supports AI-driven memory search via function calling loop
     * 
     * Note: Gemini API limitation - built-in tools (google_search, url_context) cannot
     * be mixed with function calling. When built-in tools are enabled, we pre-search
     * memories and include them in the prompt instead of using function calling.
     */
    async rewrite(text: string, options: RewriterOptions = {}): Promise<string> {
        const { preset, instruction, enableUrlContext, enableGoogleSearch, enableSupermemorySearch } = options;

        // Build the instruction prompt
        const rewriteInstruction = preset
            ? PRESET_PROMPTS[preset]
            : (instruction || 'Improve this text');

        let prompt = `${rewriteInstruction}\n\nText to rewrite:\n${text}`;
        const systemPrompt = `You are a text rewriting assistant. 
        Rewrite the given text according to the instruction.
        Output ONLY the rewritten text itself with no preamble, introduction, or meta-commentary.
        Do NOT add phrases like "Here is the simpler version", "Here's a friendlier version", etc.
        Preserve the original formatting style unless instructed otherwise.
        Maintain the same language as the input text.
        Start directly with the rewritten content.`;

        // Check if built-in tools are enabled
        const hasBuiltInTools = enableUrlContext || enableGoogleSearch;

        // Build tools array based on options
        const tools: Array<Record<string, unknown>> = [];
        if (enableUrlContext) {
            tools.push({ url_context: {} });
        }
        if (enableGoogleSearch) {
            tools.push({ google_search: {} });
        }

        // IMPORTANT: Gemini API limitation - cannot mix built-in tools with function calling
        // When built-in tools are enabled, we use pre-search approach instead of function calling
        // Only add memory search function tool if NO built-in tools are enabled
        const useMemoryFunctionCalling = enableSupermemorySearch && !hasBuiltInTools;
        if (useMemoryFunctionCalling) {
            tools.push(getMemorySearchTool());
        }

        // If memory search is enabled WITH built-in tools, do a pre-search and add to prompt
        if (enableSupermemorySearch && hasBuiltInTools) {
            log.info('Using pre-search for memories in rewrite (built-in tools detected)');
            const searchResult = await searchMemories({
                query: text, // Search based on the text being rewritten
                limit: 5,
                threshold: 0.5,
            });

            if (searchResult.success && searchResult.results.length > 0) {
                const memoryContext = formatMemoriesForPrompt(searchResult.results);
                prompt = `${prompt}\n${memoryContext}`;
                log.debug('Added memory context to rewrite via pre-search', {
                    memoryCount: searchResult.results.length,
                });
            }
        }

        // Get API configuration
        const provider = await this.getProviderInfo();

        // Build initial conversation contents
        const contents: Array<{ role: string; parts: GeminiContentPart[] }> = [
            { role: 'user', parts: [{ text: prompt }] }
        ];

        const baseBody: Record<string, unknown> = {
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: Math.max(text.length * 2, 500),
                topP: 0.95,
            },
        };

        // Add tools if any are enabled
        if (tools.length > 0) {
            baseBody.tools = tools;
        }

        log.debug('Making rewrite API call', {
            textLength: text.length,
            preset,
            hasInstruction: !!instruction,
            provider: provider.type,
            tools: tools.length > 0 ? tools.map(t => Object.keys(t)[0]) : undefined,
            memoryMode: useMemoryFunctionCalling ? 'function-calling' : (enableSupermemorySearch ? 'pre-search' : 'disabled'),
        });

        // Function calling loop - only used when memory function calling is enabled
        // (i.e., no built-in tools are active)
        const MAX_FUNCTION_CALLS = 3;
        let functionCallCount = 0;

        while (functionCallCount < MAX_FUNCTION_CALLS) {
            const response = await fetch(provider.url, {
                method: 'POST',
                headers: provider.headers,
                body: JSON.stringify({ ...baseBody, contents }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                log.error('API error', { status: response.status, error: errorText });
                throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const candidate = data?.candidates?.[0];

            // Check if the model wants to call a function (only when using function calling mode)
            if (useMemoryFunctionCalling && hasFunctionCall(candidate)) {
                functionCallCount++;
                const functionCall = extractFunctionCall(candidate);

                if (functionCall) {
                    log.info('AI requested memory search for rewrite', {
                        functionName: functionCall.name,
                        iteration: functionCallCount,
                    });

                    // Execute the memory search
                    const result = await executeMemorySearch(functionCall);

                    // Add model's function call to conversation
                    contents.push({
                        role: 'model',
                        parts: candidate.content?.parts || [],
                    });

                    // Add function response to conversation
                    contents.push({
                        role: 'user',
                        parts: [{
                            functionResponse: {
                                name: functionCall.name,
                                response: { result: result.formattedResult },
                            },
                        }],
                    });

                    log.debug('Added function response to rewrite conversation', {
                        resultSuccess: result.success,
                        resultLength: result.formattedResult.length,
                    });

                    // Continue the loop to get the model's final response
                    continue;
                }
            }

            // No function call - extract and return the rewritten text
            const rewrittenText = candidate?.content?.parts?.[0]?.text;

            if (!rewrittenText) {
                log.error('No text in response', { data });
                throw new Error('No text generated');
            }

            log.info('Rewrite complete', {
                inputLength: text.length,
                outputLength: rewrittenText.length,
                preset,
                functionCallsUsed: functionCallCount,
            });

            return rewrittenText;
        }

        // If we exhausted function calls, try one more time without memory tool
        log.warn('Max function calls reached for rewrite, making final request without memory tool');
        const finalTools = tools.filter(t => !('function_declarations' in t));
        const finalBody = {
            ...baseBody,
            contents,
            ...(finalTools.length > 0 ? { tools: finalTools } : {}),
        };

        const finalResponse = await fetch(provider.url, {
            method: 'POST',
            headers: provider.headers,
            body: JSON.stringify(finalBody),
        });

        if (!finalResponse.ok) {
            const errorText = await finalResponse.text();
            throw new Error(`Gemini API error: ${finalResponse.status} - ${errorText}`);
        }

        const finalData = await finalResponse.json();
        const rewrittenText = finalData?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rewrittenText) {
            throw new Error('No text generated after function calls');
        }

        return rewrittenText;
    }
}

// Export singleton instance
export const geminiRewriter = new GeminiRewriter();
