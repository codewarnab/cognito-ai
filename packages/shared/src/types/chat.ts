/**
 * Chat Types
 * Shared types for AI chat functionality
 */

/**
 * Represents a single message in an AI chat conversation.
 */
export interface AIChatMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | unknown[];
}

/**
 * Request body for AI chat completions.
 */
export interface AIChatRequestBody {
    messages: AIChatMessage[];
    system?: string;
    model?: string;
}

/**
 * Standard error response structure for AI endpoints.
 */
export interface AIChatErrorResponse {
    error: string;
    message: string;
    details?: string;
    retryAfter?: number;
}

/**
 * Chat mode options
 * - chat: Simple conversations, minimal tool guidance
 * - agent: Full agentic mode with tool execution
 * - adaptive: Dynamic tool discovery pattern
 */
export type ChatMode = 'chat' | 'agent' | 'adaptive';
