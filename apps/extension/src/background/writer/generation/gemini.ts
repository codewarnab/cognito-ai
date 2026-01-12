/**
 * Gemini/Vertex Generation Module
 * 
 * Handles text generation using Google's Gemini and Vertex AI APIs.
 * Supports built-in tools (URL context, Google Search) and memory function calling.
 * 
 * @module writer/generation/gemini
 */

import { createLogger } from '~logger';
import { getProvider } from '../../providers';
import {
    getMemorySearchTool,
    hasFunctionCall,
    extractFunctionCall,
    executeMemorySearch,
    type GeminiContentPart,
} from '../../supermemory';
import { searchMemories, formatMemoriesForPrompt } from '../../supermemory';
import { buildGeminiRequestParts } from '../content-builders';
import { buildSystemPrompt } from '../core/prompts';
import type { WriterOptions, GeminiMessage } from '../core/types';
import {
    MAX_FUNCTION_CALLS,
    DEFAULT_MAX_TOKENS,
    DEFAULT_TEMPERATURE,
    DEFAULT_TOP_P,
} from '../core/types';

const log = createLogger('GeminiGeneration', 'BACKGROUND');

/**
 * Generates text using Google Gemini or Vertex AI.
 * 
 * Features:
 * - Multimodal support (images, PDFs)
 * - Built-in URL context tool
 * - Built-in Google Search grounding tool
 * - Memory search via function calling
 * 
 * Note: Gemini API limitation - cannot mix built-in tools with function calling.
 * When both are enabled, memory search falls back to pre-search mode.
 * 
 * @param {string} prompt - The user prompt
 * @param {WriterOptions} [options] - Generation options
 * @returns {Promise<string>} The generated text
 * 
 * @example
 * ```typescript
 * const result = await generateWithGemini("Write about current events", {
 *   enableGoogleSearch: true,
 *   enableUrlContext: true,
 * });
 * ```
 */
export async function generateWithGemini(
    prompt: string,
    options?: WriterOptions
): Promise<string> {
    const provider = await getProvider();
    const config = await provider.getConfig(false);
    const systemPrompt = buildSystemPrompt(options);
    const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS;

    // Check if built-in tools are enabled
    const hasBuiltInTools = options?.enableUrlContext || options?.enableGoogleSearch;

    // Build tools array based on options
    const tools: Array<Record<string, unknown>> = [];
    if (options?.enableUrlContext) {
        tools.push({ url_context: {} });
    }
    if (options?.enableGoogleSearch) {
        tools.push({ google_search: {} });
    }

    // IMPORTANT: Gemini API limitation - cannot mix built-in tools with function calling
    const useMemoryFunctionCalling = options?.enableSupermemorySearch && !hasBuiltInTools;
    if (useMemoryFunctionCalling) {
        tools.push(getMemorySearchTool());
    }

    // If memory search is enabled WITH built-in tools, pre-search
    let enrichedPrompt = prompt;
    if (options?.enableSupermemorySearch && hasBuiltInTools) {
        log.info('Using pre-search for memory (built-in tools active)');
        const searchResult = await searchMemories({
            query: prompt,
            limit: 5,
            threshold: 0.5,
        });

        if (searchResult.success && searchResult.results.length > 0) {
            const memoryContext = formatMemoriesForPrompt(searchResult.results);
            enrichedPrompt = `${prompt}\n${memoryContext}`;
            log.debug('Pre-enriched prompt with memory context', {
                memoriesFound: searchResult.results.length,
            });
        }
    }

    const contents: GeminiMessage[] = [{
        role: 'user',
        parts: buildGeminiRequestParts(enrichedPrompt, options) as GeminiContentPart[],
    }];

    const baseBody = {
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        generationConfig: {
            temperature: DEFAULT_TEMPERATURE,
            maxOutputTokens: maxTokens,
            topP: DEFAULT_TOP_P,
        },
        ...(tools.length > 0 && { tools }),
    };

    log.info('Making Gemini/Vertex API call', {
        provider: config.type,
        model: config.modelName,
        hasUrlContext: !!options?.enableUrlContext,
        hasGoogleSearch: !!options?.enableGoogleSearch,
        hasMemorySearch: !!options?.enableSupermemorySearch,
        usingFunctionCalling: useMemoryFunctionCalling,
        hasAttachment: !!options?.attachment,
        toolCount: tools.length,
    });

    // Function calling loop
    let functionCallCount = 0;

    while (functionCallCount < MAX_FUNCTION_CALLS) {
        const response = await fetch(config.url, {
            method: 'POST',
            headers: config.headers,
            body: JSON.stringify({ ...baseBody, contents }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('Gemini API error', { status: response.status, error: errorText });
            throw new Error(`${config.type} API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const candidate = data?.candidates?.[0];

        // Check for function call (only when using memory function calling)
        if (useMemoryFunctionCalling && hasFunctionCall(candidate)) {
            functionCallCount++;
            const functionCall = extractFunctionCall(candidate);

            if (functionCall) {
                log.info('AI requested memory search for generation (Gemini)', {
                    functionName: functionCall.name,
                    iteration: functionCallCount,
                });

                const result = await executeMemorySearch(functionCall);

                // Add model's response to conversation
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

                log.debug('Added function response to generation conversation (Gemini)', {
                    resultSuccess: result.success,
                    resultLength: result.formattedResult.length,
                });

                continue;
            }
        }

        // No function call - return the generated text
        const text = candidate?.content?.parts?.[0]?.text;

        if (!text) {
            log.error('No text in Gemini response', { data });
            throw new Error('No text generated');
        }

        log.info('Gemini generation complete', {
            outputLength: text.length,
            functionCallsUsed: functionCallCount,
        });

        return text;
    }

    // Final request without function declarations (keep built-in tools)
    log.warn('Max function calls reached for Gemini generation, making final request');
    const finalTools = tools.filter(t => !('function_declarations' in t));
    const finalBody = {
        ...baseBody,
        contents,
        ...(finalTools.length > 0 ? { tools: finalTools } : {}),
    };

    const finalResponse = await fetch(config.url, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify(finalBody),
    });

    if (!finalResponse.ok) {
        const errorText = await finalResponse.text();
        throw new Error(`${config.type} API error: ${finalResponse.status} - ${errorText}`);
    }

    const finalData = await finalResponse.json();
    return finalData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Streams text generation using Google Gemini or Vertex AI.
 * 
 * Features:
 * - Multimodal support (images, PDFs)
 * - Built-in URL context tool
 * - Built-in Google Search grounding tool
 * 
 * Note: Memory search via function calling is not supported in streaming mode.
 * Use the non-streaming generate method if memory search is required.
 * 
 * @param {string} prompt - The user prompt
 * @param {WriterOptions} [options] - Generation options
 * @yields {string} Text chunks as they are generated
 * 
 * @example
 * ```typescript
 * for await (const chunk of streamWithGemini("Tell me a story")) {
 *   process.stdout.write(chunk);
 * }
 * ```
 */
export async function* streamWithGemini(
    prompt: string,
    options?: WriterOptions
): AsyncGenerator<string, void, unknown> {
    const provider = await getProvider();
    const config = await provider.getConfig(true);
    const systemPrompt = buildSystemPrompt(options);
    const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS;

    // Build tools array
    const tools: Array<Record<string, unknown>> = [];
    if (options?.enableUrlContext) {
        tools.push({ url_context: {} });
    }
    if (options?.enableGoogleSearch) {
        tools.push({ google_search: {} });
    }

    const parts = buildGeminiRequestParts(prompt, options);

    const body = {
        contents: [{
            role: 'user',
            parts,
        }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        generationConfig: {
            temperature: DEFAULT_TEMPERATURE,
            maxOutputTokens: maxTokens,
            topP: DEFAULT_TOP_P,
        },
        ...(tools.length > 0 && { tools }),
    };

    log.info('Making Gemini/Vertex streaming API call', {
        provider: config.type,
        model: config.modelName,
        hasUrlContext: !!options?.enableUrlContext,
        hasGoogleSearch: !!options?.enableGoogleSearch,
        hasAttachment: !!options?.attachment,
        toolCount: tools.length,
    });

    const response = await fetch(config.url, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${config.type} API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data && data !== '[DONE]') {
                        try {
                            const parsed = JSON.parse(data);
                            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (text) yield text;
                        } catch {
                            // Ignore JSON parse errors in stream
                        }
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}
