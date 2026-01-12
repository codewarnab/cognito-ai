/**
 * OpenAI Generation Module
 * 
 * Handles text generation using OpenAI's Chat Completions API.
 * Supports multimodal content, web search, and memory function calling.
 * 
 * @module writer/generation/openai
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
import type { WriterOptions, OpenAIMessage } from '../core/types';
import {
    MAX_FUNCTION_CALLS,
    DEFAULT_MAX_TOKENS,
    DEFAULT_TEMPERATURE,
    DEFAULT_TOP_P,
} from '../core/types';

const log = createLogger('OpenAIGeneration', 'BACKGROUND');

/**
 * Generates text using OpenAI's Chat Completions API.
 * 
 * Features:
 * - Multimodal support (images, PDFs)
 * - Web search via pre-search approach
 * - Memory search via function calling
 * 
 * Note: URL context is NOT available for OpenAI (Gemini-specific feature).
 * 
 * @param {string} prompt - The user prompt
 * @param {WriterOptions} [options] - Generation options
 * @returns {Promise<string>} The generated text
 * 
 * @example
 * ```typescript
 * const result = await generateWithOpenAI("Write a blog post about AI", {
 *   tone: 'professional',
 *   enableGoogleSearch: true,
 * });
 * ```
 */
export async function generateWithOpenAI(
    prompt: string,
    options?: WriterOptions
): Promise<string> {
    const provider = await getProvider();
    const config = await provider.getConfig(false);
    const systemPrompt = buildSystemPrompt(options);
    const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS;

    // Note: URL context is NOT available for OpenAI - Gemini-specific feature
    if (options?.enableUrlContext) {
        log.warn('URL context not available for OpenAI provider - feature will be skipped');
    }

    // Build tools array - OpenAI can handle both web search and custom tools together
    const tools: any[] = [];
    if (options?.enableSupermemorySearch) {
        tools.push(getMemorySearchToolOpenAI());
    }

    // Build initial messages with attachment support
    const messages: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildOpenAIMessageContent(prompt, options) as any },
    ];

    log.info('Making OpenAI API call with function calling', {
        provider: 'openai',
        model: config.modelName,
        hasWebSearch: !!options?.enableGoogleSearch,
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
            max_completion_tokens: maxTokens,
            top_p: DEFAULT_TOP_P,
        };

        // Add tools if any are enabled
        if (tools.length > 0) {
            body.tools = tools;
        }

        // Add web search if enabled (pre-search approach for first iteration)
        if (options?.enableGoogleSearch && functionCallCount === 0) {
            const webSearchResult = await performWebSearch('openai', prompt);
            if (webSearchResult.type === 'presearch' && webSearchResult.result.success) {
                // Enrich the user message with search results
                const enrichedContent = buildOpenAIMessageContent(
                    enrichPromptWithSearch(prompt, webSearchResult.result),
                    options
                );
                const lastMessage = messages[messages.length - 1];
                if (lastMessage) {
                    lastMessage.content = enrichedContent as any;
                }
                log.debug('Enriched prompt with web search results', {
                    citationCount: webSearchResult.result.citations.length,
                });
            }
        }

        const response = await fetch(config.url, {
            method: 'POST',
            headers: config.headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('OpenAI API error', { status: response.status, error: errorText });
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Check if the model wants to call a function
        if (options?.enableSupermemorySearch && hasOpenAIToolCall(data)) {
            functionCallCount++;
            const toolCall = extractOpenAIToolCall(data);

            if (toolCall) {
                log.info('AI requested memory search for generation (OpenAI)', {
                    functionName: toolCall.function.name,
                    iteration: functionCallCount,
                });

                // Execute the memory search
                const result = await executeOpenAIMemorySearch(toolCall);

                // Add assistant's response with tool call to conversation
                messages.push(data.choices[0].message);

                // Add tool response to conversation
                messages.push(buildOpenAIToolResponse(toolCall.id, result.formattedResult) as any);

                log.debug('Added tool response to generation conversation (OpenAI)', {
                    resultSuccess: result.success,
                    resultLength: result.formattedResult.length,
                });

                continue;
            }
        }

        // No tool call - return the generated text
        const generatedText = data.choices?.[0]?.message?.content;

        if (!generatedText) {
            log.error('No text in OpenAI response', { data });
            throw new Error('No text generated');
        }

        log.info('OpenAI generation complete', {
            outputLength: generatedText.length,
            functionCallsUsed: functionCallCount,
        });

        return generatedText;
    }

    // If we exhausted function calls, make a final request without tools
    log.warn('Max function calls reached for OpenAI generation, making final request');
    const finalBody = {
        model: config.modelName,
        messages,
        temperature: DEFAULT_TEMPERATURE,
        max_completion_tokens: maxTokens,
        top_p: DEFAULT_TOP_P,
    };

    const finalResponse = await fetch(config.url, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify(finalBody),
    });

    if (!finalResponse.ok) {
        const errorText = await finalResponse.text();
        throw new Error(`OpenAI API error: ${finalResponse.status} - ${errorText}`);
    }

    const finalData = await finalResponse.json();
    return finalData.choices?.[0]?.message?.content || '';
}

/**
 * Streams text generation using OpenAI's Chat Completions API.
 * 
 * Features:
 * - Multimodal support (images, PDFs)
 * - Web search via pre-search approach
 * - Memory search via function calling (pre-processed before streaming)
 * 
 * @param {string} prompt - The user prompt
 * @param {WriterOptions} [options] - Generation options
 * @yields {string} Text chunks as they are generated
 * 
 * @example
 * ```typescript
 * for await (const chunk of streamWithOpenAI("Write a story")) {
 *   process.stdout.write(chunk);
 * }
 * ```
 */
export async function* streamWithOpenAI(
    prompt: string,
    options?: WriterOptions
): AsyncGenerator<string, void, unknown> {
    const provider = await getProvider();
    const config = await provider.getConfig(true);
    const systemPrompt = buildSystemPrompt(options);
    const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS;

    // Note: URL context is NOT available for OpenAI - Gemini-specific feature
    if (options?.enableUrlContext) {
        log.warn('URL context not available for OpenAI provider - feature will be skipped');
    }

    // Handle memory search first (non-streaming) if enabled
    let memoryContext = '';
    if (options?.enableSupermemorySearch) {
        log.info('Handling memory search before streaming (OpenAI)');

        // Build tools array
        const tools = [getMemorySearchToolOpenAI()];

        // Build initial messages
        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: buildOpenAIMessageContent(prompt, options) },
        ];

        // Function calling loop (non-streaming)
        let functionCallCount = 0;
        const nonStreamConfig = await provider.getConfig(false);

        while (functionCallCount < MAX_FUNCTION_CALLS) {
            const body = {
                model: nonStreamConfig.modelName,
                messages,
                tools,
                temperature: DEFAULT_TEMPERATURE,
                max_completion_tokens: maxTokens,
                top_p: DEFAULT_TOP_P,
            };

            const response = await fetch(nonStreamConfig.url, {
                method: 'POST',
                headers: nonStreamConfig.headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();

            if (hasOpenAIToolCall(data)) {
                functionCallCount++;
                const toolCall = extractOpenAIToolCall(data);

                if (toolCall) {
                    log.info('AI requested memory search for streaming generation (OpenAI)', {
                        iteration: functionCallCount,
                    });

                    const result = await executeOpenAIMemorySearch(toolCall);
                    messages.push(data.choices[0].message);
                    messages.push(buildOpenAIToolResponse(toolCall.id, result.formattedResult));

                    // Store memory context for the final streaming request
                    if (result.success) {
                        memoryContext = result.formattedResult;
                    }
                    continue;
                }
            }

            // No more tool calls needed
            break;
        }
    }

    // Now do the streaming request
    let enrichedPrompt = prompt;

    // Add memory context if available
    if (memoryContext) {
        enrichedPrompt = buildMemoryEnrichedPrompt(prompt, memoryContext);
    }

    // Handle web search for OpenAI (using Responses API pre-search)
    if (options?.enableGoogleSearch) {
        log.info('Using OpenAI web search for streaming generation');
        const webSearchResult = await performWebSearch('openai', prompt);
        if (webSearchResult.type === 'presearch' && webSearchResult.result.success) {
            enrichedPrompt = enrichPromptWithSearch(enrichedPrompt, webSearchResult.result);
            log.debug('Enriched prompt with web search results', {
                citationCount: webSearchResult.result.citations.length,
            });
        }
    }

    const body = {
        model: config.modelName,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: buildOpenAIMessageContent(enrichedPrompt, options) }
        ],
        temperature: DEFAULT_TEMPERATURE,
        max_completion_tokens: maxTokens,
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
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
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
