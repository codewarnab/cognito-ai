/**
 * Gemini/Vertex Rewriter Provider
 * Handles text rewriting using Google's Gemini API with advanced features
 * Supports URL context, Google Search, and memory search via function calling
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
import { REWRITER_SYSTEM_PROMPT, calculateMaxTokens } from '../prompts';
import { REWRITER_CONSTANTS, type ProviderConfig } from '../types';

const log = createLogger('GeminiRewriter', 'BACKGROUND');

/**
 * Rewrite text using Gemini/Vertex API
 * Supports:
 * - URL context (built-in tool)
 * - Google Search (built-in tool)
 * - Memory search (function calling OR pre-search fallback)
 * 
 * Note: Gemini API limitation - cannot mix built-in tools with function calling
 * When built-in tools are enabled, memory search uses pre-search approach
 * 
 * @param text - The text to rewrite
 * @param prompt - The complete user prompt with instruction
 * @param options - Rewrite options
 * @returns The rewritten text
 */
export async function rewriteWithGemini(
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

    const provider = await getProvider();
    const config = await provider.getConfig(false) as ProviderConfig;

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
    let currentPrompt = prompt;
    if (enableSupermemorySearch && hasBuiltInTools) {
        log.info('Using pre-search for memories in rewrite (built-in tools detected)');
        const searchResult = await searchMemories({
            query: text,
            limit: 5,
            threshold: 0.5,
        });

        if (searchResult.success && searchResult.results.length > 0) {
            const memoryContext = formatMemoriesForPrompt(searchResult.results);
            currentPrompt = `${prompt}\n${memoryContext}`;
            log.debug('Added memory context to rewrite via pre-search', {
                memoryCount: searchResult.results.length,
            });
        }
    }

    // Build initial conversation contents
    const contents: Array<{ role: string; parts: GeminiContentPart[] }> = [
        { role: 'user', parts: [{ text: currentPrompt }] }
    ];

    const baseBody: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: REWRITER_SYSTEM_PROMPT }] },
        generationConfig: {
            temperature: REWRITER_CONSTANTS.DEFAULT_TEMPERATURE,
            maxOutputTokens: calculateMaxTokens(text.length),
            topP: REWRITER_CONSTANTS.DEFAULT_TOP_P,
        },
    };

    // Add tools if any are enabled
    if (tools.length > 0) {
        baseBody.tools = tools;
    }

    log.debug('Making rewrite API call', {
        textLength: text.length,
        preset,
        provider: config.type,
        tools: tools.length > 0 ? tools.map(t => Object.keys(t)[0]) : undefined,
        memoryMode: useMemoryFunctionCalling ? 'function-calling' : (enableSupermemorySearch ? 'pre-search' : 'disabled'),
    });

    // Function calling loop - only used when memory function calling is enabled
    let functionCallCount = 0;

    while (functionCallCount < REWRITER_CONSTANTS.MAX_FUNCTION_CALLS) {
        const response = await fetch(config.url, {
            method: 'POST',
            headers: config.headers,
            body: JSON.stringify({ ...baseBody, contents }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('API error', { status: response.status, error: errorText });
            throw new Error(`${config.type} API error: ${response.status} - ${errorText}`);
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
    const rewrittenText = finalData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rewrittenText) {
        throw new Error('No text generated after function calls');
    }

    return rewrittenText;
}
