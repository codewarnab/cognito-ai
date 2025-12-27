/**
 * Anthropic Provider
 * Direct API integration with Anthropic's Messages API
 *
 * Supports:
 * - Text generation (streaming and non-streaming)
 * - Function/tool calling
 * - Prompt caching for cost efficiency
 * - Web search (via server tool - Phase 5)
 *
 * References:
 * - Messages API: https://docs.anthropic.com/claude/reference/messages_post
 * - Tool Use: https://docs.anthropic.com/en/docs/agents-and-tools/tool-use
 * - Prompt Caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
 */

import { getAnthropicApiKey } from '@/utils/credentials';
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
// Anthropic Request/Response Types
// ============================================================

/**
 * Anthropic message structure
 */
interface AnthropicMessage {
    role: 'user' | 'assistant';
    content: string | AnthropicContentBlock[];
}

/**
 * Anthropic content block types
 */
interface AnthropicContentBlock {
    type: 'text' | 'tool_use' | 'tool_result';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    tool_use_id?: string;
    content?: string;
    /** Cache control for prompt caching */
    cache_control?: { type: 'ephemeral' };
}

/**
 * System content block with cache control
 */
interface AnthropicSystemBlock {
    type: 'text';
    text: string;
    cache_control?: { type: 'ephemeral' };
}

/**
 * Anthropic-specific request body structure
 */
interface AnthropicRequestBody extends BaseRequestBody {
    model: string;
    max_tokens: number;
    messages: AnthropicMessage[];
    system?: string | AnthropicSystemBlock[];
    temperature?: number;
    top_p?: number;
    stream?: boolean;
    tools?: AnthropicToolDefinition[];
    tool_choice?: { type: 'auto' } | { type: 'any' } | { type: 'tool'; name: string };
}

/**
 * Anthropic tool/function definition
 */
interface AnthropicToolDefinition {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
    cache_control?: { type: 'ephemeral' };
}

/**
 * Anthropic API response structure (non-streaming)
 */
interface AnthropicResponse {
    id?: string;
    type?: 'message';
    role?: 'assistant';
    content?: AnthropicContentBlock[];
    model?: string;
    stop_reason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
    stop_sequence?: string | null;
    usage?: {
        input_tokens: number;
        output_tokens: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
    };
}

/**
 * Anthropic streaming event types
 */
interface AnthropicStreamEvent {
    type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop' | 'ping';
    index?: number;
    message?: AnthropicResponse;
    content_block?: AnthropicContentBlock;
    delta?: {
        type?: string;
        text?: string;
        stop_reason?: string;
    };
}

/**
 * Anthropic Provider Implementation
 */
export class AnthropicProvider implements IProvider {
    readonly type = 'anthropic' as const;

    private readonly baseUrl = 'https://api.anthropic.com/v1';
    private readonly anthropicVersion = '2023-06-01';
    /** Beta header for prompt caching */
    private readonly promptCachingBeta = 'prompt-caching-2024-07-31';

    async getConfig(_streaming: boolean = false): Promise<ProviderConfig> {
        const apiKey = await getAnthropicApiKey();
        if (!apiKey) {
            throw new Error('Anthropic API key not found');
        }

        const modelConfig = getContentScriptModel('anthropic');

        return {
            type: 'anthropic',
            url: `${this.baseUrl}/messages`,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': this.anthropicVersion,
                // Enable prompt caching beta
                'anthropic-beta': this.promptCachingBeta,
            },
            modelName: modelConfig.model,
        };
    }

    /**
     * Build request body for text generation
     * Uses prompt caching for system prompt to reduce costs
     */
    buildRequestBody(
        systemPrompt: string,
        userPrompt: string,
        options: GenerationOptions
    ): AnthropicRequestBody {
        const modelConfig = getContentScriptModel('anthropic');

        return {
            model: modelConfig.model,
            max_tokens: options.maxTokens,
            // Use structured system with cache_control for prompt caching
            system: [
                {
                    type: 'text',
                    text: systemPrompt,
                    cache_control: { type: 'ephemeral' },
                }
            ],
            messages: [
                { role: 'user', content: userPrompt }
            ],
            temperature: options.temperature ?? 0.3,
            top_p: options.topP ?? 0.9,
            stream: options.stream ?? false,
        };
    }

    /**
     * Parse a streaming response chunk
     * Anthropic uses Server-Sent Events format with typed events
     */
    parseStreamChunk(data: string): string | null {
        try {
            const parsed: AnthropicStreamEvent = JSON.parse(data);

            // Handle content_block_delta events with text
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                return parsed.delta?.text ?? null;
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Parse a non-streaming response
     * Extracts text from the first text content block
     */
    parseResponse(response: unknown): string {
        const anthropicResponse = response as AnthropicResponse;
        const textBlock = anthropicResponse?.content?.find(
            (block) => block.type === 'text'
        );
        return textBlock?.text ?? '';
    }

    // ============================================================
    // Function/Tool Calling Methods
    // ============================================================

    /**
     * Build request body with function/tool calling
     * Includes cache_control on tools for prompt caching efficiency
     *
     * @param systemPrompt System prompt
     * @param userPrompt User prompt
     * @param options Generation options
     * @param tools Array of tools to include
     * @returns Anthropic request body with tools
     */
    buildRequestBodyWithTools(
        systemPrompt: string,
        userPrompt: string,
        options: GenerationOptions,
        tools: ProviderTool[]
    ): AnthropicRequestBody {
        const modelConfig = getContentScriptModel('anthropic');

        // Convert provider-agnostic tools to Anthropic format
        // Add cache_control to the last tool for efficient caching
        const anthropicTools: AnthropicToolDefinition[] = tools.map((tool, index) => {
            const toolDef: AnthropicToolDefinition = {
                name: tool.name,
                description: tool.description,
                input_schema: tool.parameters,
            };

            // Add cache_control to the last tool to cache the entire tool list
            if (index === tools.length - 1) {
                toolDef.cache_control = { type: 'ephemeral' };
            }

            return toolDef;
        });

        return {
            model: modelConfig.model,
            max_tokens: options.maxTokens,
            // System with cache control
            system: [
                {
                    type: 'text',
                    text: systemPrompt,
                    cache_control: { type: 'ephemeral' },
                }
            ],
            messages: [
                { role: 'user', content: userPrompt }
            ],
            temperature: options.temperature ?? 0.3,
            top_p: options.topP ?? 0.9,
            stream: options.stream ?? false,
            tools: anthropicTools.length > 0 ? anthropicTools : undefined,
            tool_choice: anthropicTools.length > 0 ? { type: 'auto' } : undefined,
        };
    }

    /**
     * Parse tool calls from Anthropic response
     * Anthropic returns tool_use content blocks when tools are invoked
     *
     * @param response Full response JSON from Anthropic
     * @returns Array of parsed tool calls, or null if none
     */
    parseToolCalls(response: unknown): ToolCall[] | null {
        const anthropicResponse = response as AnthropicResponse;

        // Check if this is a tool_use stop reason
        if (anthropicResponse?.stop_reason !== 'tool_use') {
            return null;
        }

        const toolUseBlocks = anthropicResponse?.content?.filter(
            (block) => block.type === 'tool_use'
        );

        if (!toolUseBlocks || toolUseBlocks.length === 0) {
            return null;
        }

        return toolUseBlocks.map((block) => ({
            id: block.id!,
            name: block.name!,
            arguments: block.input ?? {},
        }));
    }

    /**
     * Build follow-up request with tool results
     * After executing tools, use this to build the next request with results.
     *
     * @param previousMessages Previous conversation messages (including tool calls)
     * @param toolResults Results from tool executions
     * @returns Request body for continuation
     */
    buildToolResultRequest(
        previousMessages: Message[],
        toolResults: ToolResult[]
    ): AnthropicRequestBody {
        const modelConfig = getContentScriptModel('anthropic');

        // Convert our Message format to Anthropic format
        const anthropicMessages: AnthropicMessage[] = [];
        let systemPrompt = '';

        for (const msg of previousMessages) {
            if (msg.role === 'system') {
                // Extract system prompt to use separately
                systemPrompt = msg.content ?? '';
            } else if (msg.role === 'assistant') {
                // For assistant messages with tool calls, convert to Anthropic format
                if (msg.tool_calls && msg.tool_calls.length > 0) {
                    const content: AnthropicContentBlock[] = [];

                    // Add any text content first
                    if (msg.content) {
                        content.push({ type: 'text', text: msg.content });
                    }

                    // Add tool_use blocks
                    for (const tc of msg.tool_calls) {
                        content.push({
                            type: 'tool_use',
                            id: tc.id,
                            name: tc.name,
                            input: tc.arguments,
                        });
                    }

                    anthropicMessages.push({
                        role: 'assistant',
                        content,
                    });
                } else {
                    anthropicMessages.push({
                        role: 'assistant',
                        content: msg.content ?? '',
                    });
                }
            } else if (msg.role === 'user') {
                anthropicMessages.push({
                    role: 'user',
                    content: msg.content ?? '',
                });
            }
            // Skip 'tool' messages as we'll add tool_result blocks from toolResults
        }

        // Add tool results as user message with tool_result content blocks
        const toolResultContent: AnthropicContentBlock[] = toolResults.map((tr) => ({
            type: 'tool_result' as const,
            tool_use_id: tr.toolCallId,
            content: typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result),
        }));

        anthropicMessages.push({
            role: 'user',
            content: toolResultContent,
        });

        return {
            model: modelConfig.model,
            max_tokens: 4096,
            system: systemPrompt ? [
                {
                    type: 'text',
                    text: systemPrompt,
                    cache_control: { type: 'ephemeral' },
                }
            ] : undefined,
            messages: anthropicMessages,
            temperature: 0.3,
            top_p: 0.9,
            stream: false,
        };
    }
}

/**
 * Create a new Anthropic provider instance
 */
export function createAnthropicProvider(): AnthropicProvider {
    return new AnthropicProvider();
}
