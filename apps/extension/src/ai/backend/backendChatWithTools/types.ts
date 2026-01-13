/**
 * Backend Chat with Tools - Type Definitions
 *
 * Shared types and interfaces for the backend chat with tools module.
 * These types define the contracts between the various sub-modules.
 *
 * @module backendChatWithTools/types
 */

import type { UIMessage } from 'ai';
import type { ToolMode } from '@/stores/tools/types';
import type { ToolCall, ToolResult } from '../frontendToolExecutor';

/**
 * Parameters for streaming backend chat with frontend tool execution.
 *
 * @remarks
 * This is the main configuration interface for the `streamBackendChatWithTools` function.
 * The backend uses a fixed model (gemini-2.5-flash), so no model parameter is accepted.
 *
 * @example
 * ```typescript
 * const params: BackendChatWithToolsParams = {
 *     messages: chatMessages,
 *     systemPrompt: 'You are a helpful assistant.',
 *     mode: 'agent',
 *     maxSteps: 20,
 *     searchEnabled: true,
 *     onToolCall: (tc) => console.log('Tool called:', tc.name),
 *     onToolResult: (result) => console.log('Tool result:', result.id),
 * };
 * ```
 */
export interface BackendChatWithToolsParams {
    /**
     * The conversation messages to send to the backend.
     * These are UIMessages from the chat interface.
     */
    messages: UIMessage[];

    /**
     * Optional system prompt to prepend to the conversation.
     * Provides context and instructions for the AI model.
     */
    systemPrompt?: string;

    // Note: model is NOT accepted - backend uses a fixed model (gemini-2.5-flash)

    /**
     * AI mode determining which tools are available and how they're discovered.
     *
     * - `chat`: Minimal tools for simple conversations
     * - `agent`: Full tool access with browser automation capabilities
     * - `adaptive`: Dynamic tool discovery using meta-tools
     *
     * Backend uses this to select the appropriate system prompt and behavior.
     *
     * @default 'agent'
     */
    mode?: ToolMode;

    /**
     * Maximum number of tool execution steps in the frontend loop.
     *
     * @remarks
     * This prevents infinite loops when tools keep calling other tools.
     * Each step represents one round-trip to the backend.
     *
     * @default 20
     */
    maxSteps?: number;

    /**
     * Abort signal for cancellation support.
     *
     * @remarks
     * When triggered, the current request will be aborted and
     * an 'aborted' status will be written to the stream.
     */
    abortSignal?: AbortSignal;

    /**
     * Callback invoked when an error occurs.
     *
     * @param error - The error that occurred.
     */
    onError?: (error: Error) => void;

    /**
     * Callback invoked when the stream completes successfully.
     */
    onFinishCallback?: () => void;

    /**
     * Callback invoked when a tool call is received from the AI.
     *
     * @param toolCall - The tool call details including name and arguments.
     */
    onToolCall?: (toolCall: ToolCall) => void;

    /**
     * Callback invoked when a tool execution completes.
     *
     * @param result - The tool result including success/error status.
     */
    onToolResult?: (result: ToolResult) => void;

    /**
     * Initial page context captured when conversation started.
     *
     * @remarks
     * This is a formatted string from `formatPageContextForAI()` containing
     * DOM content, metadata, or other relevant page information.
     * Only sent on the first request, not on tool result follow-ups.
     */
    initialPageContext?: string;

    /**
     * Whether search mode is enabled.
     *
     * @remarks
     * When true, the backend will:
     * - Add the webSearch tool and execute it server-side
     * - Frontend will NOT send webSearch in tool schemas
     *
     * This allows server-side search without exposing API keys to the client.
     */
    searchEnabled?: boolean;

    /**
     * Whether YouTube transcript tool should be executed on the server.
     *
     * @remarks
     * When true, the backend will:
     * - Add the getYouTubeTranscript tool
     * - Execute it server-side using Supadata API
     *
     * This keeps the Supadata token secure on the server.
     */
    youtubeEnabled?: boolean;

    /**
     * Names of enabled MCP servers.
     *
     * @remarks
     * Sent to backend to inform the AI about available integrations.
     * The backend will add this to the system prompt so the AI knows
     * what MCP servers are connected (useful for adaptive mode discovery).
     */
    enabledMcpServerNames?: string[];
}

/**
 * Parsed stream event from AI SDK v6 UI Message Stream.
 *
 * @remarks
 * These events are parsed from Server-Sent Events (SSE) chunks
 * received from the backend streaming response.
 */
export type ParsedStreamEvent = {
    /**
     * The type of stream event.
     *
     * - `text`: Text content delta from the AI
     * - `text_start`: Start of a text block (usually ignored, handled manually)
     * - `text_end`: End of a text block (usually ignored, handled manually)
     * - `tool_call`: AI wants to call a tool
     * - `tool_result`: Server-executed tool completed
     * - `tool_error`: Tool execution failed
     * - `finish`: Stream finished successfully
     * - `error`: Stream error occurred
     */
    type: 'text' | 'text_start' | 'text_end' | 'tool_call' | 'tool_result' | 'tool_error' | 'finish' | 'error';

    /**
     * The event payload.
     * Structure varies by event type.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
};

/**
 * Extended tool error information for the AI feedback loop.
 *
 * @remarks
 * When a tool fails (e.g., unavailable tool), we need to provide
 * enough context for the AI to understand what went wrong and
 * potentially retry with a different approach.
 */
export interface ToolErrorInfo {
    /**
     * Unique identifier for the failed tool call.
     */
    id: string;

    /**
     * Name of the tool that failed.
     */
    name: string;

    /**
     * Input arguments that were passed to the tool.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input: any;

    /**
     * Error message or description of why the tool failed.
     */
    result: string;
}
