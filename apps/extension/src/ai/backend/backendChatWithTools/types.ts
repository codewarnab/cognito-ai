/**
 * Types and interfaces for Backend Chat with Tools
 */

import type { UIMessage } from 'ai';
import type { ToolMode } from '@/stores/tools/types';
import type { ToolCall, ToolResult } from '../frontendToolExecutor';

/**
 * Parameters for streaming backend chat with frontend tool execution
 */
export interface BackendChatWithToolsParams {
    messages: UIMessage[];
    systemPrompt?: string;
    // Note: model is NOT accepted - backend uses a fixed model (gemini-2.5-flash)
    /** 
     * AI mode: 'chat' (minimal tools), 'agent' (all tools), or 'adaptive' (dynamic discovery)
     * Backend uses this to select appropriate system prompt
     */
    mode?: ToolMode;
    /**
     * Maximum number of tool execution steps (frontend loop limit)
     * Defaults to 10 if not specified
     */
    maxSteps?: number;
    abortSignal?: AbortSignal;
    onError?: (error: Error) => void;
    onFinishCallback?: () => void;
    onToolCall?: (toolCall: ToolCall) => void;
    onToolResult?: (result: ToolResult) => void;
    /**
     * Initial page context captured when conversation started.
     * Formatted string from formatPageContextForAI()
     */
    initialPageContext?: string;
    /**
     * Whether search mode is enabled.
     * When true, backend will add webSearch tool and execute it server-side.
     * Frontend will NOT send webSearch in tool schemas.
     */
    searchEnabled?: boolean;
    /**
     * Whether YouTube transcript tool should be executed on the server.
     * When true, backend will add getYouTubeTranscript tool and execute it server-side.
     * This allows the backend to use Supadata API without exposing tokens to the client.
     */
    youtubeEnabled?: boolean;
}

/**
 * Parsed stream event from AI SDK v6 UI Message Stream
 */
export type ParsedStreamEvent = {
    type: 'text' | 'text_start' | 'text_end' | 'tool_call' | 'tool_result' | 'tool_error' | 'finish' | 'error';
    data: any;
};

/**
 * Tool error with extended info for proper messages
 */
export interface ToolErrorInfo {
    id: string;
    name: string;
    input: any;
    result: string;
}
