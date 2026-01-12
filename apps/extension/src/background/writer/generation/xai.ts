/**
 * xAI Generation Module
 * 
 * Handles text generation using xAI's API (Grok models).
 * Uses OpenAI-compatible format with xAI-specific configurations.
 * 
 * @module writer/generation/xai
 */

import { createLogger } from '~logger';
import { getProvider, performWebSearch, enrichPromptWithSearch } from '../../providers';
import {
    getMemorySearchToolOpenAI,
    hasOpenAIToolCall,
    extractOpenAIToolCall,
    executeOpenAIMemorySearch,
    buildOpenAIToolResponse,
} from '../../supermemory';
import { buildOpenAIMessageContent } from '../content-builders';
import { buildSystemPrompt, buildMemoryEnrichedPrompt } from '../core/prompts';
import type { WriterOptions } from '../core/types';
import {
    MAX_FUNCTION_CALLS,
    DEFAULT_MAX_TOKENS,
    DEFAULT_TEMPERATURE,
    DEFAULT_TOP_P,
} from '../core/types';

const log = createLogger('XAIGeneration', 'BACKGROUND');

/**
 * Generates text using xAI's API.
 * 
 * Features:
 * - Multimodal support (images, PDFs) via OpenAI-compatible format
 * - Web search via xAI live search (pre-search approach)
 * - Memory search via function calling
 * 
 * Note: URL context is NOT available for xAI (Gemini-specific feature).
 * 
 * @param {string} prompt - The user prompt
 * @param {WriterOptions} [options] - Generation options
 * @returns {Promise<string>} The generated text
 * 
 * @example
 * ```typescript
 * const result = await generateWithXAI("Explain quantum computing", {
 *   tone: 'casual',
 *   enableSupermemorySearch: true,
 * });
 * ```
 */
export async function generateWithXAI(
    prompt: string,
    options?: WriterOptions
): Promise<string> {
    const provider = await getProvider();
    const config = await provider.getConfig(false);
    const systemPrompt = buildSystemPrompt(options);
    const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS;

    // xAI does NOT support URL context
    if (options?.enableUrlContext) {
        log.warn('URL context not available for xAI provider - feature will be skipped');
    }

    let workingPrompt = prompt;

    // Handle web search via xAI live search (pre-search approach)
    if (options?.enableGoogleSearch) {
        const webSearchResult = await performWebSearch('xai', prompt);
        if (webSearchResult.type === 'presearch' && webSearchResult.result.success) {
            workingPrompt = enrichPromptWithSearch(workingPrompt, webSearchResult.result);
            log.debug('Enriched writer prompt with xAI live search results', {
                citationCount: webSearchResult.result.citations.length,
            });
        }
    }

    // Build tools array
    const tools: any[] = [];
    if (options?.enableSupermemorySearch) {
        tools.push(getMemorySearchToolOpenAI());
    }

    // Build initial messages with attachment support (reuse OpenAI format which is compatible)
    const messages: any[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildOpenAIMessageContent(workingPrompt, options) },
    ];

    log.info('Making xAI API call', {
        provider: 'xai',
        model: config.modelName,
        hasMemorySearch: !!options?.enableSupermemorySearch,
        hasAttachment: !!options?.attachment,
        toolCount: tools.length,
    });

    // Function calling loop
    let functionCallCount = 0;

    while (functionCallCount < MAX_FUNCTION_CALLS) {
        const body: any = {
            model: config.modelName,
            messages,
            temperature: DEFAULT_TEMPERATURE,
            max_tokens: maxTokens, // xAI uses max_tokens
            top_p: DEFAULT_TOP_P,
            stream: false,
        };

        // Add tools if any are enabled
        if (tools.length > 0) {
            body.tools = tools;
        }

        const response = await fetch(config.url, {
            method: 'POST',
            headers: config.headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('xAI API error', { status: response.status, error: errorText });
            throw new Error(`xAI API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Check if the model wants to call a function
        if (options?.enableSupermemorySearch && hasOpenAIToolCall(data)) {
            functionCallCount++;
            const toolCall = extractOpenAIToolCall(data);

            if (toolCall) {
                log.info('AI requested memory search for generation (xAI)', {
                    functionName: toolCall.function.name,
                    iteration: functionCallCount,
                });

                // Execute the memory search
                const result = await executeOpenAIMemorySearch(toolCall);

                // Add assistant's response with tool call to conversation
                messages.push(data.choices[0].message);

                // Add tool response to conversation
                messages.push(buildOpenAIToolResponse(toolCall.id, result.formattedResult));

                continue;
            }
        }

        // No tool call - return the generated text
        const generatedText = data.choices?.[0]?.message?.content;

        if (!generatedText) {
            log.error('No text in xAI response', { data });
            throw new Error('No text generated');
        }

        return generatedText;
    }

    // If exhausted function calls
    log.warn('Max function calls reached for xAI generation, making final request');
    const finalBody = {
        model: config.modelName,
        messages,
        temperature: DEFAULT_TEMPERATURE,
        max_tokens: maxTokens,
        top_p: DEFAULT_TOP_P,
        stream: false,
    };

    const finalResponse = await fetch(config.url, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify(finalBody),
    });

    if (!finalResponse.ok) {
        const errorText = await finalResponse.text();
        throw new Error(`xAI API error: ${finalResponse.status} - ${errorText}`);
    }

    const finalData = await finalResponse.json();
    return finalData.choices?.[0]?.message?.content || '';
}

/**
 * Streams text generation using xAI's API.
 * 
 * Features:
 * - Multimodal support via OpenAI-compatible format
 * - Memory search via function calling (pre-processed before streaming)
 * 
 * Note: Web search is not available for xAI streaming.
 * 
 * @param {string} prompt - The user prompt
 * @param {WriterOptions} [options] - Generation options
 * @yields {string} Text chunks as they are generated
 * 
 * @example
 * ```typescript
 * for await (const chunk of streamWithXAI("Write a poem")) {
 *   process.stdout.write(chunk);
 * }
 * ```
 */
export async function* streamWithXAI(
    prompt: string,
    options?: WriterOptions
): AsyncGenerator<string, void, unknown> {
    const provider = await getProvider();
    const config = await provider.getConfig(true);
    const systemPrompt = buildSystemPrompt(options);
    const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS;

    if (options?.enableUrlContext) {
        log.warn('URL context not available for xAI provider - feature will be skipped');
    }
    if (options?.enableGoogleSearch) {
        log.warn('Web search not available for xAI provider - feature will be skipped');
    }

    // Handle memory search first (non-streaming) if enabled
    let memoryContext = '';
    if (options?.enableSupermemorySearch) {
        // Similar logic to OpenAI for memory search
        const tools = [getMemorySearchToolOpenAI()];
        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: buildOpenAIMessageContent(prompt, options) },
        ];

        let functionCallCount = 0;
        const nonStreamConfig = await provider.getConfig(false);

        while (functionCallCount < MAX_FUNCTION_CALLS) {
            const body = {
                model: nonStreamConfig.modelName,
                messages,
                tools,
                temperature: DEFAULT_TEMPERATURE,
                max_tokens: maxTokens,
                top_p: DEFAULT_TOP_P,
                stream: false
            };

            const response = await fetch(nonStreamConfig.url, {
                method: 'POST',
                headers: nonStreamConfig.headers,
                body: JSON.stringify(body),
            });

            if (response.ok) {
                const data = await response.json();
                if (hasOpenAIToolCall(data)) {
                    functionCallCount++;
                    const toolCall = extractOpenAIToolCall(data);
                    if (toolCall) {
                        const result = await executeOpenAIMemorySearch(toolCall);
                        messages.push(data.choices[0].message);
                        messages.push(buildOpenAIToolResponse(toolCall.id, result.formattedResult));
                        if (result.success) memoryContext = result.formattedResult;
                        continue;
                    }
                }
            }
            break;
        }
    }

    let enrichedPrompt = prompt;
    if (memoryContext) {
        enrichedPrompt = buildMemoryEnrichedPrompt(prompt, memoryContext);
    }

    const body = {
        model: config.modelName,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: buildOpenAIMessageContent(enrichedPrompt, options) }
        ],
        temperature: DEFAULT_TEMPERATURE,
        max_tokens: maxTokens,
        top_p: DEFAULT_TOP_P,
        stream: true,
    };

    const response = await fetch(config.url, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`xAI API error: ${response.status} - ${errorText}`);
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
                            const text = parsed.choices?.[0]?.delta?.content;
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
