/**
 * OpenAI Rewriter Provider
 * Handles text rewriting using the OpenAI API with function calling support
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
import { REWRITER_SYSTEM_PROMPT, calculateMaxTokens } from '../prompts';
import { REWRITER_CONSTANTS, type ProviderConfig } from '../types';

const log = createLogger('OpenAIRewriter', 'BACKGROUND');

/**
 * Rewrite text using OpenAI API
 * Supports web search (pre-search) and memory search (function calling)
 * 
 * @param text - The text to rewrite
 * @param prompt - The complete user prompt with instruction
 * @param options - Rewrite options
 * @returns The rewritten text
 */
export async function rewriteWithOpenAI(
    text: string,
    prompt: string,
    options: {
        enableUrlContext?: boolean;
        enableGoogleSearch?: boolean;
        enableSupermemorySearch?: boolean;
        preset?: string;
    }
): Promise<string> {
    const { enableUrlContext, enableGoogleSearch, enableSupermemorySearch, preset } = options;
    const maxTokens = calculateMaxTokens(text.length);

    const provider = await getProvider();
    const config = await provider.getConfig(false) as ProviderConfig;

    // Note: URL context is NOT available for OpenAI - Gemini-specific feature
    if (enableUrlContext) {
        log.warn('URL context not available for OpenAI provider - feature will be skipped');
    }

    // Build tools array - OpenAI can handle both web search and custom tools together
    const tools: any[] = [];
    if (enableSupermemorySearch) {
        tools.push(getMemorySearchToolOpenAI());
    }

    // Build initial messages
    const messages: any[] = [
        { role: 'system', content: REWRITER_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
    ];

    log.info('Making OpenAI rewrite call', {
        hasWebSearch: !!enableGoogleSearch,
        hasMemorySearch: !!enableSupermemorySearch,
        toolCount: tools.length,
    });

    // Handle web search via pre-search approach
    if (enableGoogleSearch) {
        const webSearchResult = await performWebSearch('openai', text);
        if (webSearchResult.type === 'presearch' && webSearchResult.result.success) {
            messages[messages.length - 1].content = enrichPromptWithSearch(prompt, webSearchResult.result);
            log.debug('Enriched rewrite prompt with web search results', {
                citationCount: webSearchResult.result.citations.length,
            });
        }
    }

    // Function calling loop
    let functionCallCount = 0;

    while (functionCallCount < REWRITER_CONSTANTS.MAX_FUNCTION_CALLS) {
        const body: any = {
            model: config.modelName,
            messages,
            temperature: REWRITER_CONSTANTS.DEFAULT_TEMPERATURE,
            max_completion_tokens: maxTokens,
            top_p: REWRITER_CONSTANTS.DEFAULT_TOP_P,
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
            log.error('OpenAI API error', { status: response.status, error: errorText });
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Check if the model wants to call a function
        if (enableSupermemorySearch && hasOpenAIToolCall(data)) {
            functionCallCount++;
            const toolCall = extractOpenAIToolCall(data);

            if (toolCall) {
                log.info('AI requested memory search for rewrite (OpenAI)', {
                    functionName: toolCall.function.name,
                    iteration: functionCallCount,
                });

                // Execute the memory search
                const result = await executeOpenAIMemorySearch(toolCall);

                // Add assistant's response with tool call to conversation
                messages.push(data.choices[0].message);

                // Add tool response to conversation
                messages.push(buildOpenAIToolResponse(toolCall.id, result.formattedResult));

                log.debug('Added tool response to rewrite conversation (OpenAI)', {
                    resultSuccess: result.success,
                    resultLength: result.formattedResult.length,
                });

                continue;
            }
        }

        // No tool call - extract and return the rewritten text
        const rewrittenText = data.choices?.[0]?.message?.content;

        if (!rewrittenText) {
            log.error('No text in OpenAI response', { data });
            throw new Error('No text generated');
        }

        log.info('OpenAI Rewrite complete', {
            inputLength: text.length,
            outputLength: rewrittenText.length,
            preset,
            functionCallsUsed: functionCallCount,
        });

        return rewrittenText;
    }

    // If we exhausted function calls, make a final request without tools
    log.warn('Max function calls reached for OpenAI rewrite, making final request');
    const finalBody = {
        model: config.modelName,
        messages,
        temperature: REWRITER_CONSTANTS.DEFAULT_TEMPERATURE,
        max_completion_tokens: maxTokens,
        top_p: REWRITER_CONSTANTS.DEFAULT_TOP_P,
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
