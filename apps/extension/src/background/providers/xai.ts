/**
 * xAI Provider
 * Direct API integration with xAI's API
 *
 * Supports:
 * - Text generation (streaming and non-streaming)
 * - Function/tool calling
 *
 * References:
 * - Documentation: https://docs.x.ai/docs
 */

import { getXaiApiKey } from '@/utils/credentials';
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
// OpenAI/xAI Compatible Request/Response Types
// ============================================================

/**
 * Message structure
 */
interface XaiMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content?: string | null;
    tool_calls?: XaiToolCall[];
    tool_call_id?: string;
}

/**
 * Request body structure
 */
interface XaiRequestBody extends BaseRequestBody {
    model: string;
    messages: XaiMessage[];
    temperature: number;
    stream: boolean;
    // xAI might not support max_completion_tokens in the exact same way as newer OpenAI models, commonly max_tokens
    // but the plan says it's OpenAI compatible. Let's use max_tokens which is standard.
    max_tokens?: number;
    top_p?: number;
}

/**
 * Request body with tools
 */
interface XaiRequestBodyWithTools extends XaiRequestBody {
    tools?: XaiToolFunction[];
    tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
}

/**
 * Tool/function definition
 */
interface XaiToolFunction {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}

/**
 * Tool call structure in response
 */
interface XaiToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string; // JSON string
    };
}

/**
 * API response structure (non-streaming)
 */
interface XaiResponse {
    choices?: Array<{
        message?: {
            content?: string | null;
            tool_calls?: XaiToolCall[];
        };
        finish_reason?: string;
    }>;
}

/**
 * Streaming response structure
 */
interface XaiStreamResponse {
    choices?: Array<{
        delta?: {
            content?: string;
        };
    }>;
}

/**
 * xAI Provider Implementation
 */
export class XAIProvider implements IProvider {
    readonly type = 'xai' as const;

    private readonly baseUrl = 'https://api.x.ai/v1';

    async getConfig(_streaming: boolean = false): Promise<ProviderConfig> {
        const apiKey = await getXaiApiKey();
        if (!apiKey) {
            throw new Error('xAI API key not found');
        }

        const modelConfig = getContentScriptModel('xai');

        return {
            type: 'xai',
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
    ): XaiRequestBody {
        const modelConfig = getContentScriptModel('xai');

        return {
            model: modelConfig.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: options.temperature ?? 0.3,
            max_tokens: options.maxTokens,
            top_p: options.topP ?? 0.9,
            stream: options.stream ?? false,
        };
    }

    parseStreamChunk(data: string): string | null {
        try {
            const parsed: XaiStreamResponse = JSON.parse(data);
            return parsed?.choices?.[0]?.delta?.content ?? null;
        } catch {
            return null;
        }
    }

    parseResponse(response: unknown): string {
        const xaiResponse = response as XaiResponse;
        return xaiResponse?.choices?.[0]?.message?.content ?? '';
    }

    // ============================================================
    // Function/Tool Calling Methods
    // ============================================================

    buildRequestBodyWithTools(
        systemPrompt: string,
        userPrompt: string,
        options: GenerationOptions,
        tools: ProviderTool[]
    ): XaiRequestBodyWithTools {
        const modelConfig = getContentScriptModel('xai');

        // Convert provider-agnostic tools to OpenAI/xAI format
        const xaiTools: XaiToolFunction[] = tools.map((tool) => ({
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
            max_tokens: options.maxTokens,
            top_p: options.topP ?? 0.9,
            stream: options.stream ?? false,
            tools: xaiTools.length > 0 ? xaiTools : undefined,
            tool_choice: xaiTools.length > 0 ? 'auto' : undefined,
        };
    }

    parseToolCalls(response: unknown): ToolCall[] | null {
        const xaiResponse = response as XaiResponse;
        const choice = xaiResponse?.choices?.[0];
        const toolCalls = choice?.message?.tool_calls;

        if (!toolCalls || toolCalls.length === 0) {
            return null;
        }

        return toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: this.safeParseArguments(tc.function.arguments),
        }));
    }

    buildToolResultRequest(
        previousMessages: Message[],
        toolResults: ToolResult[]
    ): XaiRequestBody {
        const modelConfig = getContentScriptModel('xai');

        const xaiMessages: XaiMessage[] = previousMessages.map((msg) => ({
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

        const toolResultMessages: XaiMessage[] = toolResults.map((tr) => ({
            role: 'tool' as const,
            tool_call_id: tr.toolCallId,
            content: typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result),
        }));

        return {
            model: modelConfig.model,
            messages: [...xaiMessages, ...toolResultMessages],
            temperature: 0.3,
            max_tokens: 4096,
            top_p: 0.9,
            stream: false,
        };
    }

    private safeParseArguments(argsString: string): Record<string, unknown> {
        try {
            return JSON.parse(argsString);
        } catch {
            return {};
        }
    }
}
