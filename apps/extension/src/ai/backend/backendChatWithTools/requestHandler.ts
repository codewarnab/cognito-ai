/**
 * Backend Chat with Tools - Request Handler
 *
 * Handles HTTP communication with the backend API.
 * Manages request construction, error handling, and response validation.
 *
 * @module backendChatWithTools/requestHandler
 */

import type { ModelMessage } from 'ai';
import { createLogger } from '~logger';
import { BACKEND_URL, CHAT_WITH_TOOLS_ENDPOINT, REQUEST_HEADERS } from './constants';

const log = createLogger('RequestHandler', 'AI_CHAT_BACKEND');

/**
 * Parameters for making a backend chat request.
 */
export interface BackendRequestParams {
    /**
     * Conversation messages to send to the backend.
     */
    messages: ModelMessage[];

    /**
     * System prompt for the AI model.
     */
    systemPrompt?: string;

    /**
     * Sanitized tool schemas for the backend.
     */
    tools: Record<string, unknown>;

    /**
     * Chat mode: 'agent', 'chat', or 'adaptive'.
     */
    mode: string;

    /**
     * Maximum steps per request (typically 1 for tool execution loop).
     */
    maxSteps: number;

    /**
     * Page context to include (only on first request).
     */
    pageContext?: string;

    /**
     * Whether search tools are enabled (backend adds and executes them).
     */
    searchEnabled?: boolean;

    /**
     * Whether YouTube transcript should be server-executed.
     */
    youtubeEnabled?: boolean;

    /**
     * Names of enabled MCP servers (sent to backend for system prompt).
     */
    enabledMcpServerNames?: string[];

    /**
     * Abort signal for cancellation support.
     */
    signal?: AbortSignal;
}

/**
 * Result of a backend request.
 */
export interface BackendRequestResult {
    /**
     * Response body reader for streaming.
     */
    reader: ReadableStreamDefaultReader<Uint8Array>;

    /**
     * Text decoder for parsing stream chunks.
     */
    decoder: TextDecoder;
}

/**
 * Custom error for backend request failures.
 */
export class BackendRequestError extends Error {
    /**
     * HTTP status code from the backend response.
     */
    public readonly statusCode: number;

    /**
     * Error data from the backend response body.
     */
    public readonly errorData: Record<string, unknown>;

    constructor(message: string, statusCode: number, errorData: Record<string, unknown> = {}) {
        super(message);
        this.name = 'BackendRequestError';
        this.statusCode = statusCode;
        this.errorData = errorData;
    }
}

/**
 * Makes a request to the backend chat-with-tools API.
 *
 * This function:
 * 1. Constructs the request with proper headers and body
 * 2. Sends the request to the backend
 * 3. Validates the response status
 * 4. Returns a reader for streaming the response
 *
 * @param params - Request parameters including messages, tools, and options.
 *
 * @returns Promise resolving to a reader and decoder for processing the stream.
 *
 * @throws {BackendRequestError} If the backend returns a non-OK response.
 * @throws {Error} If the response body is null.
 *
 * @example
 * ```typescript
 * const { reader, decoder } = await makeBackendRequest({
 *     messages: conversationMessages,
 *     tools: sanitizedSchemas,
 *     mode: 'agent',
 *     maxSteps: 1,
 *     signal: abortController.signal,
 * });
 *
 * while (true) {
 *     const { done, value } = await reader.read();
 *     if (done) break;
 *     const chunk = decoder.decode(value, { stream: true });
 *     // Process chunk...
 * }
 * ```
 */
export async function makeBackendRequest(
    params: BackendRequestParams
): Promise<BackendRequestResult> {
    const {
        messages,
        systemPrompt,
        tools,
        mode,
        maxSteps,
        pageContext,
        searchEnabled,
        youtubeEnabled,
        enabledMcpServerNames,
        signal,
    } = params;

    log.info('Making backend request', {
        messageCount: messages.length,
        mode,
        maxSteps,
        hasPageContext: !!pageContext,
    });

    // Debug: Log the full messages structure for debugging
    console.log('[BACKEND-DEBUG] Messages being sent:', JSON.stringify(messages, null, 2));

    const response = await fetch(
        `${BACKEND_URL}${CHAT_WITH_TOOLS_ENDPOINT}`,
        {
            method: 'POST',
            headers: REQUEST_HEADERS,
            body: JSON.stringify({
                messages,
                system: systemPrompt,
                tools,
                mode,
                maxSteps,
                pageContext,
                searchEnabled,
                youtubeEnabled,
                enabledMcpServerNames,
            }),
            signal,
        }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = (errorData as Record<string, string>).message || `Backend error: ${response.status}`;
        throw new BackendRequestError(message, response.status, errorData);
    }

    if (!response.body) {
        throw new Error('No response body from backend');
    }

    return {
        reader: response.body.getReader(),
        decoder: new TextDecoder(),
    };
}

/**
 * Builds the request body for the backend API.
 *
 * @param params - Request parameters.
 * @returns JSON-serializable request body.
 *
 * @internal
 */
export function buildRequestBody(params: Omit<BackendRequestParams, 'signal'>): Record<string, unknown> {
    return {
        messages: params.messages,
        system: params.systemPrompt,
        tools: params.tools,
        mode: params.mode,
        maxSteps: params.maxSteps,
        pageContext: params.pageContext,
        searchEnabled: params.searchEnabled,
        youtubeEnabled: params.youtubeEnabled,
        enabledMcpServerNames: params.enabledMcpServerNames,
    };
}
