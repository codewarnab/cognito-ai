/**
 * Anthropic/Claude Generation Module
 * 
 * Handles text generation using Anthropic's Claude API.
 * Supports multimodal content, web search (pre-search), and memory function calling.
 * 
 * @module writer/generation/anthropic
 */

import { createLogger } from '~logger';
import { getProvider, performWebSearch, enrichPromptWithSearch } from '../../providers';
import {
    getMemorySearchToolClaude,
    hasClaudeToolUse,
    extractClaudeToolUse,
    executeClaudeMemorySearch,
    buildClaudeToolResult,
} from '../../supermemory';
import { buildAnthropicMessageContent } from '../content-builders';
import { buildSystemPrompt, buildMemoryEnrichedPrompt } from '../core/prompts';
import type { WriterOptions, AnthropicMessage } from '../core/types';
import {
    MAX_FUNCTION_CALLS,
    DEFAULT_MAX_TOKENS,
    DEFAULT_TEMPERATURE,
    DEFAULT_TOP_P,
} from '../core/types';

const log = createLogger('AnthropicGeneration', 'BACKGROUND');

/**
 * Generates text using Anthropic's Claude API.
 * 
 * Features:
 * - Multimodal support (images, PDFs)
 * - Web search via pre-search approach
 * - URL context via web_fetch tool
 * - Memory search via function calling
 * 
 * @param {string} prompt - The user prompt
 * @param {WriterOptions} [options] - Generation options
 * @returns {Promise<string>} The generated text
 * 
 * @example
 * ```typescript
 * const result = await generateWithAnthropic("Summarize this document", {
 *   attachment: {
 *     base64Data: "...",
 *     mimeType: "application/pdf",
 *     fileName: "doc.pdf",
 *     fileSize: 1024
 *   }
 * });
 * ```
 */
export async function generateWithAnthropic(
    prompt: string,
    options?: WriterOptions
): Promise<string> {
    const provider = await getProvider();
    const config = await provider.getConfig(false);
    const systemPrompt = buildSystemPrompt(options);
    const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS;

    let workingPrompt = prompt;

    // Handle web search via pre-search approach
    if (options?.enableGoogleSearch) {
        const webSearchResult = await performWebSearch('anthropic', prompt);
        if (webSearchResult.type === 'presearch' && webSearchResult.result.success) {
            workingPrompt = enrichPromptWithSearch(workingPrompt, webSearchResult.result);
            log.debug('Enriched writer prompt with Claude web search results', {
                citationCount: webSearchResult.result.citations.length,
            });
        }
    }

    // Build tools array for Claude
    const tools: any[] = [];
    if (options?.enableSupermemorySearch) {
        tools.push(getMemorySearchToolClaude());
    }

    // Handle URL context by adding web_fetch tool
    if (options?.enableUrlContext) {
        const { getWebFetchToolConfig } = await import('../../providers/anthropic/webFetch');
        tools.push(getWebFetchToolConfig({ maxUses: 3 }));
    }

    // Build initial messages with attachment support
    const messages: AnthropicMessage[] = [
        { role: 'user', content: buildAnthropicMessageContent(workingPrompt, options) },
    ];

    log.info('Making Anthropic API call with function calling', {
        provider: 'anthropic',
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
            max_tokens: maxTokens,
            system: systemPrompt,
            messages,
            temperature: DEFAULT_TEMPERATURE,
            top_p: DEFAULT_TOP_P,
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
            log.error('Claude API error', { status: response.status, error: errorText });
            throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Check if the model wants to use a tool
        if (options?.enableSupermemorySearch && hasClaudeToolUse(data)) {
            functionCallCount++;
            const toolUse = extractClaudeToolUse(data);

            if (toolUse) {
                log.info('AI requested memory search for generation (Claude)', {
                    toolName: toolUse.name,
                    iteration: functionCallCount,
                });

                // Execute the memory search
                const result = await executeClaudeMemorySearch(toolUse);

                // Add assistant's response to conversation
                messages.push({ role: 'assistant', content: data.content });

                // Add tool result to conversation
                messages.push(buildClaudeToolResult(toolUse.id, result.formattedResult, !result.success) as any);

                log.debug('Added tool result to generation conversation (Claude)', {
                    resultSuccess: result.success,
                    resultLength: result.formattedResult.length,
                });

                continue;
            }
        }

        // No tool use - return the generated text
        const textBlock = data.content?.find((block: any) => block.type === 'text');
        const generatedText = textBlock?.text;

        if (!generatedText) {
            log.error('No text in Claude response', { data });
            throw new Error('No text generated');
        }

        log.info('Claude generation complete', {
            outputLength: generatedText.length,
            functionCallsUsed: functionCallCount,
        });

        return generatedText;
    }

    // If we exhausted function calls, make a final request without tools
    log.warn('Max function calls reached for Claude generation, making final request');
    const finalBody = {
        model: config.modelName,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
        temperature: DEFAULT_TEMPERATURE,
        top_p: DEFAULT_TOP_P,
    };

    const finalResponse = await fetch(config.url, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify(finalBody),
    });

    if (!finalResponse.ok) {
        const errorText = await finalResponse.text();
        throw new Error(`Anthropic API error: ${finalResponse.status} - ${errorText}`);
    }

    const finalData = await finalResponse.json();
    const textBlock = finalData.content?.find((block: any) => block.type === 'text');
    return textBlock?.text || '';
}

/**
 * Streams text generation using Anthropic's Claude API.
 * 
 * Features:
 * - Multimodal support (images, PDFs)
 * - Memory search via function calling (pre-processed before streaming)
 * 
 * Note: Currently returns full response at once (true streaming not yet implemented).
 * 
 * @param {string} prompt - The user prompt
 * @param {WriterOptions} [options] - Generation options
 * @yields {string} Text chunks (currently yields full response at once)
 * 
 * @example
 * ```typescript
 * for await (const chunk of streamWithAnthropic("Write a haiku")) {
 *   process.stdout.write(chunk);
 * }
 * ```
 */
export async function* streamWithAnthropic(
    prompt: string,
    options?: WriterOptions
): AsyncGenerator<string, void, unknown> {
    const provider = await getProvider();
    const config = await provider.getConfig(true);
    const systemPrompt = buildSystemPrompt(options);
    const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS;

    log.info('Using Anthropic provider for streaming generation', { model: config.modelName });

    // Note: Anthropic doesn't have built-in web search or URL context
    if (options?.enableGoogleSearch) {
        log.warn('Web search not available for Anthropic provider - feature will be skipped');
    }
    if (options?.enableUrlContext) {
        log.warn('URL context not available for Anthropic provider - feature will be skipped');
    }

    // Handle memory search first (non-streaming) if enabled
    let enrichedPrompt = prompt;
    if (options?.enableSupermemorySearch) {
        log.info('Handling memory search before streaming (Claude)');

        // Build tools array
        const tools = [getMemorySearchToolClaude()];

        // Build initial messages
        const messages: any[] = [
            { role: 'user', content: buildAnthropicMessageContent(prompt, options) },
        ];

        // Function calling loop (non-streaming)
        let functionCallCount = 0;
        const nonStreamConfig = await provider.getConfig(false);

        while (functionCallCount < MAX_FUNCTION_CALLS) {
            const body = {
                model: nonStreamConfig.modelName,
                max_tokens: maxTokens,
                system: systemPrompt,
                messages,
                tools,
                temperature: DEFAULT_TEMPERATURE,
                top_p: DEFAULT_TOP_P,
            };

            const response = await fetch(nonStreamConfig.url, {
                method: 'POST',
                headers: nonStreamConfig.headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();

            if (hasClaudeToolUse(data)) {
                functionCallCount++;
                const toolUse = extractClaudeToolUse(data);

                if (toolUse) {
                    log.info('AI requested memory search for streaming generation (Claude)', {
                        iteration: functionCallCount,
                    });

                    const result = await executeClaudeMemorySearch(toolUse);
                    messages.push({ role: 'assistant', content: data.content });
                    messages.push(buildClaudeToolResult(toolUse.id, result.formattedResult, !result.success));

                    // Store memory context for the final request
                    if (result.success) {
                        enrichedPrompt = buildMemoryEnrichedPrompt(prompt, result.formattedResult);
                    }
                    continue;
                }
            }

            // No more tool calls needed
            break;
        }
    }

    // Make final request (non-streaming for now as Claude streaming is more complex)
    const body = {
        model: config.modelName,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
            { role: 'user', content: buildAnthropicMessageContent(enrichedPrompt, options) }
        ],
        temperature: DEFAULT_TEMPERATURE,
        top_p: DEFAULT_TOP_P,
    };

    const response = await fetch(config.url, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    // Anthropic returns content as an array of blocks
    const textBlock = data.content?.find((block: any) => block.type === 'text');
    const fullText = textBlock?.text || '';

    // Yield the full response at once
    if (fullText) yield fullText;
}
