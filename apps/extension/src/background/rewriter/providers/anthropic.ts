/**
 * Anthropic (Claude) Rewriter Provider
 * Handles text rewriting using the Claude API with function calling support
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
import { REWRITER_SYSTEM_PROMPT, calculateMaxTokens } from '../prompts';
import { REWRITER_CONSTANTS, type ProviderConfig } from '../types';

const log = createLogger('AnthropicRewriter', 'BACKGROUND');

/**
 * Rewrite text using Claude/Anthropic API
 * Supports web search (pre-search), URL context, and memory search (function calling)
 * 
 * @param text - The text to rewrite
 * @param prompt - The complete user prompt with instruction
 * @param options - Rewrite options
 * @returns The rewritten text
 */
export async function rewriteWithAnthropic(
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

    // Claude now supports web search via web_search_20250305 server tool
    // and URL context via web_fetch_20250910 server tool

    // Build tools array for Claude
    const tools: any[] = [];
    if (enableSupermemorySearch) {
        tools.push(getMemorySearchToolClaude());
    }

    // Handle web search via pre-search approach
    let currentPrompt = prompt;
    if (enableGoogleSearch) {
        const webSearchResult = await performWebSearch('anthropic', text);
        if (webSearchResult.type === 'presearch' && webSearchResult.result.success) {
            currentPrompt = enrichPromptWithSearch(prompt, webSearchResult.result);
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
        const { getWebFetchToolConfig } = await import('../../providers/anthropic/webFetch');
        tools.push(getWebFetchToolConfig({ maxUses: 3 }));
    }

    // Build initial messages
    const messages: any[] = [
        { role: 'user', content: currentPrompt },
    ];

    log.info('Making Claude rewrite call', {
        hasWebSearch: !!enableGoogleSearch,
        hasUrlContext: !!enableUrlContext,
        hasMemorySearch: !!enableSupermemorySearch,
        toolCount: tools.length,
    });

    // Function calling loop
    let functionCallCount = 0;

    while (functionCallCount < REWRITER_CONSTANTS.MAX_FUNCTION_CALLS) {
        const body: any = {
            model: config.modelName,
            max_tokens: maxTokens,
            system: REWRITER_SYSTEM_PROMPT,
            messages,
            temperature: REWRITER_CONSTANTS.DEFAULT_TEMPERATURE,
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
        system: REWRITER_SYSTEM_PROMPT,
        messages,
        temperature: REWRITER_CONSTANTS.DEFAULT_TEMPERATURE,
        top_p: REWRITER_CONSTANTS.DEFAULT_TOP_P,
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
