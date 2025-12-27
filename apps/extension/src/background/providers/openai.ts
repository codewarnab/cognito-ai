/**
 * OpenAI Provider
 * Direct API integration with OpenAI's Chat Completions API
 *
 * Supports:
 * - Text generation (streaming and non-streaming)
 * - Function/tool calling (Phase 2)
 *
 * References:
 * - Function Calling: https://platform.openai.com/docs/guides/function-calling
 * - Chat Completions: https://platform.openai.com/docs/api-reference/chat
 */

import { getOpenAIApiKey } from '@/utils/credentials';
import { getContentScriptModel } from '~/constants/contentScriptModels';
import type {
    IProvider,
    ProviderConfig,
    GenerationOptions,
    BaseRequestBody,
    ProviderTool,
    ToolCall,
    ToolResult,
    Message
} from './types';

// ============================================================
// OpenAI Request/Response Types
// ============================================================

/**
 * OpenAI message structure
 */
interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content?: string | null;
    tool_calls?: OpenAIToolCall[];
    tool_call_id?: string;
}

/**
 * OpenAI-specific request body structure
 */
interface OpenAIRequestBody extends BaseRequestBody {
    model: string;
    messages: OpenAIMessage[];
    temperature: number;
    max_completion_tokens: number;
    top_p: number;
    stream: boolean;
}

/**
 * OpenAI request body with tools
 */
interface OpenAIRequestBodyWithTools extends OpenAIRequestBody {
    tools?: OpenAIToolFunction[];
    tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
}

/**
 * OpenAI tool/function definition
 */
interface OpenAIToolFunction {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}

/**
 * OpenAI tool call structure in response
 */
interface OpenAIToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string; // JSON string
    };
}

/**
 * OpenAI API response structure (non-streaming)
 */
interface OpenAIResponse {
    choices?: Array<{
        message?: {
            content?: string | null;
            tool_calls?: OpenAIToolCall[];
        };
        finish_reason?: 'stop' | 'tool_calls' | 'length' | 'content_filter';
    }>;
}

/**
 * OpenAI streaming response structure
 */
interface OpenAIStreamResponse {
    choices?: Array<{
        delta?: {
            content?: string;
        };
    }>;
}

/**
 * OpenAI Provider Implementation
 */
export class OpenAIProvider implements IProvider {
    readonly type = 'openai' as const;

    private readonly baseUrl = 'https://api.openai.com/v1';

    async getConfig(_streaming: boolean = false): Promise<ProviderConfig> {
        const apiKey = await getOpenAIApiKey();
        if (!apiKey) {
            throw new Error('OpenAI API key not found');
        }

        const modelConfig = getContentScriptModel('openai');

        return {
            type: 'openai',
            url: `${this.baseUrl}/chat/completions`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            modelName: modelConfig.model,
        };
    }

    buildRequestBody(
        systemPrompt: string,
        userPrompt: string,
        options: GenerationOptions
    ): OpenAIRequestBody {
        const modelConfig = getContentScriptModel('openai');

        return {
            model: modelConfig.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: options.temperature ?? 0.3,
            max_completion_tokens: options.maxTokens,
            top_p: options.topP ?? 0.9,
            stream: options.stream ?? false,
        };
    }

    parseStreamChunk(data: string): string | null {
        try {
            const parsed: OpenAIStreamResponse = JSON.parse(data);
            return parsed?.choices?.[0]?.delta?.content ?? null;
        } catch {
            return null;
        }
    }

    parseResponse(response: unknown): string {
        const openaiResponse = response as OpenAIResponse;
        return openaiResponse?.choices?.[0]?.message?.content ?? '';
    }

    // ============================================================
    // Function/Tool Calling Methods
    // ============================================================

    /**
     * Build request body with function calling
     *
     * @param systemPrompt System prompt
     * @param userPrompt User prompt
     * @param options Generation options
     * @param tools Array of tools to include
     * @returns OpenAI request body with tools
     *
     * @example
     * const body = provider.buildRequestBodyWithTools(
     *   'You are a helpful assistant.',
     *   'Search for recent news about AI',
     *   { maxTokens: 4096 },
     *   [{ name: 'search_memory', description: 'Search memories', parameters: {...} }]
     * );
     */
    buildRequestBodyWithTools(
        systemPrompt: string,
        userPrompt: string,
        options: GenerationOptions,
        tools: ProviderTool[]
    ): OpenAIRequestBodyWithTools {
        const modelConfig = getContentScriptModel('openai');

        // Convert provider-agnostic tools to OpenAI format
        const openaiTools: OpenAIToolFunction[] = tools.map((tool) => ({
            type: 'function' as const,
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            },
        }));

        return {
            model: modelConfig.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: options.temperature ?? 0.3,
            max_completion_tokens: options.maxTokens,
            top_p: options.topP ?? 0.9,
            stream: options.stream ?? false,
            tools: openaiTools.length > 0 ? openaiTools : undefined,
            tool_choice: openaiTools.length > 0 ? 'auto' : undefined,
        };
    }

    /**
     * Parse tool calls from OpenAI response
     *
     * @param response Full response JSON from OpenAI
     * @returns Array of parsed tool calls, or null if none
     *
     * @example
     * const toolCalls = provider.parseToolCalls(response);
     * if (toolCalls) {
     *   for (const call of toolCalls) {
     *     const result = await executeTool(call.name, call.arguments);
     *   }
     * }
     */
    parseToolCalls(response: unknown): ToolCall[] | null {
        const openaiResponse = response as OpenAIResponse;
        const choice = openaiResponse?.choices?.[0];
        const toolCalls = choice?.message?.tool_calls;

        // Check if this is a tool_calls finish reason or has tool calls
        if (!toolCalls || toolCalls.length === 0) {
            return null;
        }

        return toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: this.safeParseArguments(tc.function.arguments),
        }));
    }

    /**
     * Build follow-up request with tool results
     *
     * After executing tools, use this to build the next request with results.
     *
     * @param previousMessages Previous conversation messages (including tool calls)
     * @param toolResults Results from tool executions
     * @returns Request body for continuation
     *
     * @example
     * const followUp = provider.buildToolResultRequest(
     *   [
     *     { role: 'system', content: '...' },
     *     { role: 'user', content: '...' },
     *     { role: 'assistant', tool_calls: [...] }
     *   ],
     *   [{ toolCallId: 'call_123', result: { data: '...' } }]
     * );
     */
    buildToolResultRequest(
        previousMessages: Message[],
        toolResults: ToolResult[]
    ): OpenAIRequestBody {
        const modelConfig = getContentScriptModel('openai');

        // Convert our Message format to OpenAI format
        const openaiMessages: OpenAIMessage[] = previousMessages.map((msg) => ({
            role: msg.role,
            content: msg.content ?? null,
            tool_calls: msg.tool_calls?.map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: {
                    name: tc.name,
                    arguments: JSON.stringify(tc.arguments),
                },
            })),
            tool_call_id: msg.tool_call_id,
        }));

        // Add tool result messages
        const toolResultMessages: OpenAIMessage[] = toolResults.map((tr) => ({
            role: 'tool' as const,
            tool_call_id: tr.toolCallId,
            content: typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result),
        }));

        return {
            model: modelConfig.model,
            messages: [...openaiMessages, ...toolResultMessages],
            temperature: 0.3,
            max_completion_tokens: 4096,
            top_p: 0.9,
            stream: false,
        };
    }

    /**
     * Safely parse JSON arguments from OpenAI tool call
     * OpenAI returns arguments as a JSON string that may be malformed
     */
    private safeParseArguments(argsString: string): Record<string, unknown> {
        try {
            return JSON.parse(argsString);
        } catch {
            // Return empty object if parsing fails
            return {};
        }
    }
}

/**
 * Create a new OpenAI provider instance
 */
export function createOpenAIProvider(): OpenAIProvider {
    return new OpenAIProvider();
}
