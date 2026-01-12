/**
 * Backend Chat with Tools - Constants
 *
 * Centralized configuration values for the backend chat with tools module.
 *
 * @module backendChatWithTools/constants
 */

import { ENV } from '@/utils/env';

/**
 * Backend API URL from centralized environment configuration.
 *
 * @remarks
 * This is the base URL for all backend API requests.
 * The actual endpoint is constructed by appending the specific path.
 *
 * @example
 * ```typescript
 * const url = `${BACKEND_URL}/api/ai/chat-with-tools`;
 * ```
 */
export const BACKEND_URL = ENV.BACKEND_API_URL;

/**
 * Endpoint path for the chat-with-tools API.
 *
 * @remarks
 * This endpoint handles AI chat requests with frontend tool execution support.
 */
export const CHAT_WITH_TOOLS_ENDPOINT = '/api/ai/chat-with-tools';

/**
 * Default maximum number of tool execution steps.
 *
 * @remarks
 * This limits the number of back-and-forth tool calls in a single request
 * to prevent infinite loops or runaway tool execution.
 *
 * @default 20
 */
export const DEFAULT_MAX_STEPS = 20;

/**
 * Default chat mode for tool execution.
 *
 * @remarks
 * - `agent`: Full tool access with browser automation capabilities
 * - `chat`: Limited tools, conversational mode
 * - `adaptive`: Dynamic tool discovery pattern
 *
 * @default 'agent'
 */
export const DEFAULT_MODE = 'agent' as const;

/**
 * HTTP headers for backend API requests.
 *
 * @remarks
 * These headers are required for streaming responses from the backend.
 */
export const REQUEST_HEADERS: HeadersInit = {
    'Content-Type': 'application/json',
    'Connection': 'keep-alive',
    'Accept': 'text/event-stream',
};
