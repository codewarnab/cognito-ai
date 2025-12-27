/**
 * Function Calling Handler for Supermemory
 * Handles the function call-response loop for AI-driven memory search
 * 
 * Supports:
 * - Gemini: Native function calling with function_declarations
 * - OpenAI: Function calling with tools array
 * - Claude: Tool use with input_schema
 */

import { createLogger } from '~logger';
import { searchMemories, formatMemoriesForPrompt } from './searchService';
import {
    MEMORY_SEARCH_FUNCTION,
    parseMemorySearchParams,
    getMemorySearchToolOpenAI,
    getMemorySearchToolClaude,
} from './functionDeclaration';

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

// ============================================================================
// OpenAI Function Calling Support
// ============================================================================

/**
 * Represents a function call from OpenAI
 */
export interface OpenAIToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string; // JSON string
    };
}

/**
 * Check if the OpenAI response contains a tool call for memory search
 */
export function hasOpenAIToolCall(response: { choices?: Array<{ message?: { tool_calls?: OpenAIToolCall[] } }> }): boolean {
    const toolCalls = response?.choices?.[0]?.message?.tool_calls || [];
    return toolCalls.some(tc =>
        tc.type === 'function' && tc.function?.name === MEMORY_SEARCH_FUNCTION.name
    );
}

/**
 * Extract tool call from OpenAI response if present
 */
export function extractOpenAIToolCall(response: { choices?: Array<{ message?: { tool_calls?: OpenAIToolCall[] } }> }): OpenAIToolCall | null {
    const toolCalls = response?.choices?.[0]?.message?.tool_calls || [];
    for (const tc of toolCalls) {
        if (tc.type === 'function' && tc.function?.name === MEMORY_SEARCH_FUNCTION.name) {
            return tc;
        }
    }
    return null;
}

/**
 * Execute memory search from OpenAI tool call
 */
export async function executeOpenAIMemorySearch(toolCall: OpenAIToolCall): Promise<{
    success: boolean;
    formattedResult: string;
    rawResults?: unknown;
}> {
    try {
        const args = JSON.parse(toolCall.function.arguments);
        return executeMemorySearch({ name: toolCall.function.name, args });
    } catch (error) {
        log.warn('Failed to parse OpenAI tool call arguments', { error });
        return {
            success: false,
            formattedResult: 'Failed to parse tool call arguments.',
        };
    }
}

/**
 * Build the tool response message for OpenAI
 * @see https://platform.openai.com/docs/guides/function-calling
 */
export function buildOpenAIToolResponse(toolCallId: string, result: string): {
    role: 'tool';
    tool_call_id: string;
    content: string;
} {
    return {
        role: 'tool',
        tool_call_id: toolCallId,
        content: result,
    };
}

/**
 * Get the memory search tool configuration for OpenAI requests
 */
export { getMemorySearchToolOpenAI };

// ============================================================================
// Claude/Anthropic Tool Use Support
// ============================================================================

/**
 * Represents a tool use block from Claude
 */
export interface ClaudeToolUse {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
}

/**
 * Represents a content block from Claude response
 */
export type ClaudeContentBlock =
    | { type: 'text'; text: string }
    | ClaudeToolUse;

/**
 * Check if the Claude response contains a tool use for memory search
 */
export function hasClaudeToolUse(response: { content?: ClaudeContentBlock[]; stop_reason?: string }): boolean {
    // Check if stop_reason indicates tool use
    if (response?.stop_reason !== 'tool_use') {
        return false;
    }
    const content = response?.content || [];
    return content.some(block =>
        block.type === 'tool_use' && block.name === MEMORY_SEARCH_FUNCTION.name
    );
}

/**
 * Extract tool use from Claude response if present
 */
export function extractClaudeToolUse(response: { content?: ClaudeContentBlock[] }): ClaudeToolUse | null {
    const content = response?.content || [];
    for (const block of content) {
        if (block.type === 'tool_use' && block.name === MEMORY_SEARCH_FUNCTION.name) {
            return block as ClaudeToolUse;
        }
    }
    return null;
}

/**
 * Execute memory search from Claude tool use
 */
export async function executeClaudeMemorySearch(toolUse: ClaudeToolUse): Promise<{
    success: boolean;
    formattedResult: string;
    rawResults?: unknown;
}> {
    return executeMemorySearch({ name: toolUse.name, args: toolUse.input });
}

/**
 * Build the tool result message for Claude
 * Must be a user message with tool_result content block
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
 */
export function buildClaudeToolResult(toolUseId: string, result: string, isError = false): {
    role: 'user';
    content: Array<{
        type: 'tool_result';
        tool_use_id: string;
        content: string;
        is_error?: boolean;
    }>;
} {
    return {
        role: 'user',
        content: [{
            type: 'tool_result',
            tool_use_id: toolUseId,
            content: result,
            ...(isError && { is_error: true }),
        }],
    };
}

/**
 * Get the memory search tool configuration for Claude requests
 */
export { getMemorySearchToolClaude };
