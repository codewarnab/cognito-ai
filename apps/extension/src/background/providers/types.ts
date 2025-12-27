/**
 * Provider Types
 * Shared types and interfaces for all AI providers
 */

import type { AIProvider } from '@/utils/credentials/providerTypes';

/**
 * Provider configuration for API calls
 */
export interface ProviderConfig {
    /** Provider type identifier */
    type: AIProvider;
    /** API endpoint URL */
    url: string;
    /** HTTP headers for the request */
    headers: Record<string, string>;
    /** Model name/ID to use */
    modelName: string;
}

// ============================================================
// Tool/Function Calling Types
// ============================================================

/**
 * Tool definition for function calling
 * Provider-agnostic format that can be converted to OpenAI/Gemini format
 */
export interface ProviderTool {
    /** Tool/function name */
    name: string;
    /** Description of what the tool does */
    description: string;
    /** JSON Schema for tool parameters */
    parameters: Record<string, unknown>;
}

/**
 * Parsed tool call from AI response
 */
export interface ToolCall {
    /** Unique identifier for this tool call */
    id: string;
    /** Name of the tool to execute */
    name: string;
    /** Parsed arguments for the tool */
    arguments: Record<string, unknown>;
}

/**
 * Result from executing a tool
 */
export interface ToolResult {
    /** ID of the tool call this is a result for */
    toolCallId: string;
    /** Result data from tool execution */
    result: unknown;
}

/**
 * Message in a conversation (for multi-turn with tool calls)
 */
export interface Message {
    /** Message role */
    role: 'system' | 'user' | 'assistant' | 'tool';
    /** Text content (optional for tool messages) */
    content?: string;
    /** Tool calls made by assistant (when role is 'assistant') */
    tool_calls?: ToolCall[];
    /** Tool call ID this message responds to (when role is 'tool') */
    tool_call_id?: string;
}

/**
 * Base request body structure (provider-specific implementations extend this)
 */
export interface BaseRequestBody {
    [key: string]: unknown;
}

/**
 * Common options for text generation
 */
export interface GenerationOptions {
    /** Maximum tokens to generate */
    maxTokens: number;
    /** Temperature for randomness (0-1) */
    temperature?: number;
    /** Top-p sampling */
    topP?: number;
    /** Whether to stream the response */
    stream?: boolean;
}

/**
 * Stream chunk from provider
 */
export interface StreamChunk {
    /** Text content from the chunk */
    text: string;
    /** Whether this is the final chunk */
    done?: boolean;
}

/**
 * Provider interface - each provider must implement this
 */
export interface IProvider {
    /** Provider type identifier */
    readonly type: AIProvider;

    /**
     * Get provider configuration for API calls
     * @param streaming Whether to use streaming endpoint
     */
    getConfig(streaming?: boolean): Promise<ProviderConfig>;

    /**
     * Build request body for text generation
     * @param systemPrompt System/instruction prompt
     * @param userPrompt User prompt
     * @param options Generation options
     */
    buildRequestBody(
        systemPrompt: string,
        userPrompt: string,
        options: GenerationOptions
    ): BaseRequestBody;

    /**
     * Parse a streaming response chunk
     * @param data Raw data string from SSE
     * @returns Extracted text or null if not parseable
     */
    parseStreamChunk(data: string): string | null;

    /**
     * Parse a non-streaming response
     * @param response Full response JSON
     * @returns Extracted text
     */
    parseResponse(response: unknown): string;

    // ============================================================
    // Optional Tool/Function Calling Methods
    // Providers that support function calling should implement these
    // ============================================================

    /**
     * Build request body with function/tool calling
     * @param systemPrompt System prompt
     * @param userPrompt User prompt
     * @param options Generation options
     * @param tools Tools/functions to include
     */
    buildRequestBodyWithTools?(
        systemPrompt: string,
        userPrompt: string,
        options: GenerationOptions,
        tools: ProviderTool[]
    ): BaseRequestBody;

    /**
     * Parse tool calls from response
     * @param response Full response JSON
     * @returns Array of tool calls or null if none
     */
    parseToolCalls?(response: unknown): ToolCall[] | null;

    /**
     * Build follow-up request with tool results
     * @param previousMessages Previous conversation messages
     * @param toolResults Results from tool executions
     */
    buildToolResultRequest?(
        previousMessages: Message[],
        toolResults: ToolResult[]
    ): BaseRequestBody;
}

/**
 * Provider factory function type
 */
export type ProviderFactory = () => IProvider;
