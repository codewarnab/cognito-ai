/**
 * Rewriter Client
 * Non-streaming text rewriting using the modular provider architecture
 * Supports AI-driven memory search via function calling (Gemini, OpenAI, Claude)
 */

import { getActiveProvider } from '@/utils/credentials';
import { createLogger } from '~logger';
import {
    getProvider,
    performWebSearch,
    enrichPromptWithSearch,
} from '../providers';
import {
    // Gemini function calling
    getMemorySearchTool,
    hasFunctionCall,
    extractFunctionCall,
    executeMemorySearch,
    type GeminiContentPart,
    // OpenAI function calling
    getMemorySearchToolOpenAI,
    hasOpenAIToolCall,
    extractOpenAIToolCall,
    executeOpenAIMemorySearch,
    buildOpenAIToolResponse,
    // Claude function calling
    getMemorySearchToolClaude,
    hasClaudeToolUse,
    extractClaudeToolUse,
    executeClaudeMemorySearch,
    buildClaudeToolResult,
} from '../supermemory';
import { searchMemories, formatMemoriesForPrompt } from '../supermemory';
import type { RewritePreset } from '@/types';
import { PRESET_PROMPTS } from '@cognito/shared';

const log = createLogger('Rewriter', 'BACKGROUND');

// PRESET_PROMPTS is imported from @cognito/shared

/**
 * Options for text rewriting
 */
export interface RewriterOptions {
    preset?: RewritePreset;
    instruction?: string;
    enableUrlContext?: boolean;
    enableGoogleSearch?: boolean;
    // AI-driven memory search via function calling
    enableSupermemorySearch?: boolean;
}

export class Rewriter {
    /**
     * Non-streaming rewrite generation
     * Uses single API call with optional Gemini tools
     * Supports AI-driven memory search via function calling loop (Gemini only currently)
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
        Maintain the same language as the input text.
        Start directly with the rewritten content.
        CRITICAL: If the input is a question or prompt, rewrite/expand THE QUESTION OR PROMPT ITSELF - do NOT answer it. Your job is to transform text, not to respond to it.
        
        You MAY enhance with markdown formatting when it improves readability:
        - Preserve the original text's structure and intent
        - Add markdown (bold, lists, code) only if it genuinely improves clarity
        - For 'longer' preset: structure with bullets/paragraphs as needed
        - For 'simplify' preset: minimal formatting, focus on plain language`;

        const activeProvider = await getActiveProvider();

        // -------------------------------------------------------------------------
        // OpenAI Implementation - with web search and function calling support
        // -------------------------------------------------------------------------
        if (activeProvider === 'openai') {
            const maxTokens = Math.max(text.length * 2, 500);
            const provider = await getProvider();
            const config = await provider.getConfig(false);

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
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ];

            log.info('Making OpenAI rewrite call', {
                hasWebSearch: !!enableGoogleSearch,
                hasMemorySearch: !!enableSupermemorySearch,
                toolCount: tools.length,
            });

            // Function calling loop
            const MAX_FUNCTION_CALLS = 3;
            let functionCallCount = 0;

            while (functionCallCount < MAX_FUNCTION_CALLS) {
                const body: any = {
                    model: config.modelName,
                    messages,
                    temperature: 0.7,
                    max_completion_tokens: maxTokens,
                    top_p: 0.95,
                };

                // Add tools if any are enabled
                if (tools.length > 0) {
                    body.tools = tools;
                }

                // Add web search if enabled (OpenAI has native web_search_preview tool)
                if (enableGoogleSearch) {
                    // For web search, we use pre-search approach as OpenAI web search is different
                    const webSearchResult = await performWebSearch('openai', text);
                    if (webSearchResult.type === 'presearch' && webSearchResult.result.success) {
                        // Enrich the user message with search results
                        messages[messages.length - 1].content = enrichPromptWithSearch(prompt, webSearchResult.result);
                        log.debug('Enriched rewrite prompt with web search results', {
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
                temperature: 0.7,
                max_completion_tokens: maxTokens,
                top_p: 0.95,
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

        // -------------------------------------------------------------------------
        // Claude/Anthropic Implementation - with function calling support
        // -------------------------------------------------------------------------
        if (activeProvider === 'anthropic') {
            const maxTokens = Math.max(text.length * 2, 500);
            const provider = await getProvider();
            const config = await provider.getConfig(false);

            // Claude now supports web search via web_search_20250305 server tool
            // and URL context via web_fetch_20250910 server tool

            // Build tools array for Claude
            const tools: any[] = [];
            if (enableSupermemorySearch) {
                tools.push(getMemorySearchToolClaude());
            }

            // Handle web search via pre-search approach
            if (enableGoogleSearch) {
                const webSearchResult = await performWebSearch('anthropic', text);
                if (webSearchResult.type === 'presearch' && webSearchResult.result.success) {
                    prompt = enrichPromptWithSearch(prompt, webSearchResult.result);
                    log.debug('Enriched rewrite prompt with Claude web search results', {
                        citationCount: webSearchResult.result.citations.length,
                    });
                }
            }

            // Handle URL context by adding web_fetch tool
            // Note: For Claude, URL context is a tool that Claude invokes during generation
            // This is different from Gemini's built-in url_context tool
            if (enableUrlContext) {
                // Import web fetch tool config dynamically to avoid circular deps
                const { getWebFetchToolConfig } = await import('../providers/anthropic/webFetch');
                tools.push(getWebFetchToolConfig({ maxUses: 3 }));
            }

            // Build initial messages
            const messages: any[] = [
                { role: 'user', content: prompt },
            ];

            log.info('Making Claude rewrite call', {
                hasWebSearch: !!enableGoogleSearch,
                hasUrlContext: !!enableUrlContext,
                hasMemorySearch: !!enableSupermemorySearch,
                toolCount: tools.length,
            });

            // Function calling loop
            const MAX_FUNCTION_CALLS = 3;
            let functionCallCount = 0;

            while (functionCallCount < MAX_FUNCTION_CALLS) {
                const body: any = {
                    model: config.modelName,
                    max_tokens: maxTokens,
                    system: systemPrompt,
                    messages,
                    temperature: 0.7,
                    top_p: 0.95,
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
                if (enableSupermemorySearch && hasClaudeToolUse(data)) {
                    functionCallCount++;
                    const toolUse = extractClaudeToolUse(data);

                    if (toolUse) {
                        log.info('AI requested memory search for rewrite (Claude)', {
                            toolName: toolUse.name,
                            iteration: functionCallCount,
                        });

                        // Execute the memory search
                        const result = await executeClaudeMemorySearch(toolUse);

                        // Add assistant's response to conversation
                        messages.push({ role: 'assistant', content: data.content });

                        // Add tool result to conversation
                        messages.push(buildClaudeToolResult(toolUse.id, result.formattedResult, !result.success));

                        log.debug('Added tool result to rewrite conversation (Claude)', {
                            resultSuccess: result.success,
                            resultLength: result.formattedResult.length,
                        });

                        continue;
                    }
                }

                // No tool use - extract and return the rewritten text
                const textBlock = data.content?.find((block: any) => block.type === 'text');
                const rewrittenText = textBlock?.text;

                if (!rewrittenText) {
                    log.error('No text in Claude response', { data });
                    throw new Error('No text generated');
                }

                log.info('Claude Rewrite complete', {
                    inputLength: text.length,
                    outputLength: rewrittenText.length,
                    preset,
                    functionCallsUsed: functionCallCount,
                });

                return rewrittenText;
            }

            // If we exhausted function calls, make a final request without tools
            log.warn('Max function calls reached for Claude rewrite, making final request');
            const finalBody = {
                model: config.modelName,
                max_tokens: maxTokens,
                system: systemPrompt,
                messages,
                temperature: 0.7,
                top_p: 0.95,
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

        // -------------------------------------------------------------------------
        // xAI Implementation - with function calling support
        // -------------------------------------------------------------------------
        if (activeProvider === 'xai') {
            const maxTokens = Math.max(text.length * 2, 500);
            const provider = await getProvider();
            const config = await provider.getConfig(false);

            // xAI does NOT support URL context
            if (enableUrlContext) {
                log.warn('URL context not available for xAI provider - feature will be skipped');
            }

            // Handle web search via xAI live search (pre-search approach)
            if (enableGoogleSearch) {
                const webSearchResult = await performWebSearch('xai', text);
                if (webSearchResult.type === 'presearch' && webSearchResult.result.success) {
                    prompt = enrichPromptWithSearch(prompt, webSearchResult.result);
                    log.debug('Enriched rewrite prompt with xAI live search results', {
                        citationCount: webSearchResult.result.citations.length,
                    });
                }
            }

            // Build tools array
            const tools: any[] = [];
            if (enableSupermemorySearch) {
                tools.push(getMemorySearchToolOpenAI());
            }

            // Build initial messages
            const messages: any[] = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ];

            log.info('Making xAI rewrite call', {
                hasWebSearch: !!enableGoogleSearch,
                hasMemorySearch: !!enableSupermemorySearch,
                toolCount: tools.length,
            });

            // Function calling loop
            const MAX_FUNCTION_CALLS = 3;
            let functionCallCount = 0;

            while (functionCallCount < MAX_FUNCTION_CALLS) {
                const body: any = {
                    model: config.modelName,
                    messages,
                    temperature: 0.7,
                    max_tokens: maxTokens,
                    top_p: 0.95,
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

                // Check if the model wants to call a function
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

                const rewrittenText = data.choices?.[0]?.message?.content;
                if (!rewrittenText) {
                    log.error('No text in xAI response', { data });
                    throw new Error('No text generated');
                }

                return rewrittenText;
            }

            // If exhausted function calls
            log.warn('Max function calls reached for xAI rewrite, making final request');
            const finalBody = {
                model: config.modelName,
                messages,
                temperature: 0.7,
                max_tokens: maxTokens,
                top_p: 0.95,
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

        // -------------------------------------------------------------------------
        // Gemini / Vertex Implementation - supports advanced features
        // -------------------------------------------------------------------------
        const provider = await getProvider();
        const config = await provider.getConfig(false);

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
                query: text,
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
            provider: config.type,
            tools: tools.length > 0 ? tools.map(t => Object.keys(t)[0]) : undefined,
            memoryMode: useMemoryFunctionCalling ? 'function-calling' : (enableSupermemorySearch ? 'pre-search' : 'disabled'),
        });

        // Function calling loop - only used when memory function calling is enabled
        const MAX_FUNCTION_CALLS = 3;
        let functionCallCount = 0;

        while (functionCallCount < MAX_FUNCTION_CALLS) {
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
}

// Export singleton instance
export const rewriter = new Rewriter();

// Backward compatibility aliases
export const geminiRewriter = rewriter;
export const GeminiRewriter = Rewriter;
