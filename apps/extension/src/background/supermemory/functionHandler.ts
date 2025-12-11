/**
 * Gemini Function Calling Handler for Supermemory
 * Handles the function call-response loop for AI-driven memory search
 */

import { createLogger } from '~logger';
import { searchMemories, formatMemoriesForPrompt } from './searchService';
import { MEMORY_SEARCH_FUNCTION, parseMemorySearchParams } from './functionDeclaration';

const log = createLogger('MemoryFunctionHandler', 'BACKGROUND');

/**
 * Represents a function call from Gemini
 */
export interface GeminiFunctionCall {
    name: string;
    args: unknown;
}

/**
 * Represents a part in Gemini content
 */
export interface GeminiContentPart {
    text?: string;
    functionCall?: GeminiFunctionCall;
    functionResponse?: {
        name: string;
        response: unknown;
    };
}

/**
 * Check if the response contains a function call that we can handle
 */
export function hasFunctionCall(candidate: { content?: { parts?: GeminiContentPart[] } }): boolean {
    const parts = candidate?.content?.parts || [];
    return parts.some(part =>
        part.functionCall?.name === MEMORY_SEARCH_FUNCTION.name
    );
}

/**
 * Extract function call from response if present
 */
export function extractFunctionCall(candidate: { content?: { parts?: GeminiContentPart[] } }): GeminiFunctionCall | null {
    const parts = candidate?.content?.parts || [];
    for (const part of parts) {
        if (part.functionCall?.name === MEMORY_SEARCH_FUNCTION.name) {
            return part.functionCall;
        }
    }
    return null;
}

/**
 * Execute the memory search function and return formatted result
 */
export async function executeMemorySearch(functionCall: GeminiFunctionCall): Promise<{
    success: boolean;
    formattedResult: string;
    rawResults?: unknown;
}> {
    const params = parseMemorySearchParams(functionCall.args);

    if (!params) {
        log.warn('Invalid function call parameters', { args: functionCall.args });
        return {
            success: false,
            formattedResult: 'Invalid search parameters provided.',
        };
    }

    log.info('Executing AI-requested memory search', {
        query: params.query.substring(0, 100),
        limit: params.limit,
    });

    const searchResult = await searchMemories({
        query: params.query,
        limit: params.limit,
        threshold: 0.5,
        rerank: true,
    });

    if (!searchResult.success) {
        log.warn('Memory search failed', { error: searchResult.error });
        return {
            success: false,
            formattedResult: searchResult.error || 'Memory search failed.',
        };
    }

    if (searchResult.results.length === 0) {
        return {
            success: true,
            formattedResult: 'No relevant memories found for this query.',
            rawResults: [],
        };
    }

    const formattedResult = formatMemoriesForPrompt(searchResult.results);

    log.info('Memory search completed', {
        resultCount: searchResult.results.length,
        timing: searchResult.timing,
    });

    return {
        success: true,
        formattedResult,
        rawResults: searchResult.results,
    };
}

/**
 * Build the function response content for Gemini
 */
export function buildFunctionResponseContent(
    functionCall: GeminiFunctionCall,
    result: string
): GeminiContentPart[] {
    return [{
        functionResponse: {
            name: functionCall.name,
            response: { result },
        },
    }];
}

/**
 * Get the memory search tool configuration for Gemini requests
 * Returns the tool in Gemini's expected format
 */
export function getMemorySearchTool(): { function_declarations: [typeof MEMORY_SEARCH_FUNCTION] } {
    return {
        function_declarations: [MEMORY_SEARCH_FUNCTION],
    };
}
