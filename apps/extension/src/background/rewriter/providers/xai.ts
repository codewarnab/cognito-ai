/**
 * xAI Rewriter Provider
 * Handles text rewriting using the xAI API with function calling support
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

const log = createLogger('xAIRewriter', 'BACKGROUND');

/**
 * Rewrite text using xAI API
 * Supports web search (xAI live search) and memory search (function calling via OpenAI format)
 * 
 * @param text - The text to rewrite
 * @param prompt - The complete user prompt with instruction
 * @param options - Rewrite options
 * @returns The rewritten text
 */
export async function rewriteWithXAI(
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

    // xAI does NOT support URL context
    if (enableUrlContext) {
        log.warn('URL context not available for xAI provider - feature will be skipped');
    }

    // Handle web search via xAI live search (pre-search approach)
    let currentPrompt = prompt;
    if (enableGoogleSearch) {
        const webSearchResult = await performWebSearch('xai', text);
        if (webSearchResult.type === 'presearch' && webSearchResult.result.success) {
            currentPrompt = enrichPromptWithSearch(prompt, webSearchResult.result);
            log.debug('Enriched rewrite prompt with xAI live search results', {
                citationCount: webSearchResult.result.citations.length,
            });
        }
    }

    // Build tools array (xAI uses OpenAI-compatible format)
    const tools: any[] = [];
    if (enableSupermemorySearch) {
        tools.push(getMemorySearchToolOpenAI());
    }

    // Build initial messages
    const messages: any[] = [
        { role: 'system', content: REWRITER_SYSTEM_PROMPT },
        { role: 'user', content: currentPrompt },
    ];

    log.info('Making xAI rewrite call', {
        hasWebSearch: !!enableGoogleSearch,
        hasMemorySearch: !!enableSupermemorySearch,
        toolCount: tools.length,
    });

    // Function calling loop
    let functionCallCount = 0;

    while (functionCallCount < REWRITER_CONSTANTS.MAX_FUNCTION_CALLS) {
        const body: any = {
            model: config.modelName,
            messages,
            temperature: REWRITER_CONSTANTS.DEFAULT_TEMPERATURE,
            max_tokens: maxTokens,
            top_p: REWRITER_CONSTANTS.DEFAULT_TOP_P,
            stream: false, // Rewrite is always non-streaming (for now)
        };

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

        // Check if the model wants to call a function (uses OpenAI format)
        if (enableSupermemorySearch && hasOpenAIToolCall(data)) {
            functionCallCount++;
            const toolCall = extractOpenAIToolCall(data);

            if (toolCall) {
                log.info('AI requested memory search for rewrite (xAI)', {
                    functionName: toolCall.function.name,
                    iteration: functionCallCount,
                });

                const result = await executeOpenAIMemorySearch(toolCall);
                messages.push(data.choices[0].message);
                messages.push(buildOpenAIToolResponse(toolCall.id, result.formattedResult));
                continue;
            }
        }

        // No tool call - extract and return the rewritten text
        const rewrittenText = data.choices?.[0]?.message?.content;
        if (!rewrittenText) {
            log.error('No text in xAI response', { data });
            throw new Error('No text generated');
        }

        log.info('xAI Rewrite complete', {
            inputLength: text.length,
            outputLength: rewrittenText.length,
            preset,
            functionCallsUsed: functionCallCount,
        });

        return rewrittenText;
    }

    // If exhausted function calls, make a final request without tools
    log.warn('Max function calls reached for xAI rewrite, making final request');
    const finalBody = {
        model: config.modelName,
        messages,
        temperature: REWRITER_CONSTANTS.DEFAULT_TEMPERATURE,
        max_tokens: maxTokens,
        top_p: REWRITER_CONSTANTS.DEFAULT_TOP_P,
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
