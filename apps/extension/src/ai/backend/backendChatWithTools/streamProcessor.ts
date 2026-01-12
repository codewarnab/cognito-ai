/**
 * Backend Chat with Tools - Stream Processor
 *
 * Processes the streaming response from the backend, handling events
 * and coordinating tool execution.
 *
 * @module backendChatWithTools/streamProcessor
 */

import type { ModelMessage } from 'ai';
import type { UIMessageStreamWriter } from 'ai';
import { generateId } from 'ai';
import { createLogger } from '~logger';
import { parseStreamChunk } from './streamParser';
import {
    processEvent,
    type EventHandlerContext,
    type EventProcessingState,
} from './eventHandlers';
import {
    executeToolsAndFormat,
    buildErrorFeedbackMessages,
} from './toolExecutor';
import type { ToolCall, ToolResult } from '../frontendToolExecutor';
import type { BackendRequestResult } from './requestHandler';

const log = createLogger('StreamProcessor', 'AI_CHAT_BACKEND');

/**
 * Options for stream processing.
 */
export interface StreamProcessorOptions {
    /**
     * Stream writer for sending events to the UI.
     */
    writer: UIMessageStreamWriter;

    /**
     * Mapping from sanitized tool names back to original names.
     */
    toolNameMapping: Record<string, string>;

    /**
     * Whether search mode is enabled.
     */
    searchEnabled?: boolean;

    /**
     * Abort signal for cancellation.
     */
    abortSignal?: AbortSignal;

    /**
     * Callback when a tool call is received.
     */
    onToolCall?: (toolCall: ToolCall) => void;

    /**
     * Callback when a tool result is received.
     */
    onToolResult?: (result: ToolResult) => void;
}

/**
 * Result from processing a single stream response.
 */
export interface StreamProcessingResult {
    /**
     * Whether tool calls were made and need continuation.
     */
    hasToolCalls: boolean;

    /**
     * Whether tool errors occurred and need feedback loop.
     */
    hasToolErrors: boolean;

    /**
     * Messages to append to conversation for continuation.
     */
    messagesToAppend: ModelMessage[];
}

/**
 * Processes a streaming response from the backend.
 *
 * This function:
 * 1. Reads chunks from the response stream
 * 2. Parses SSE events from each chunk
 * 3. Routes events to appropriate handlers
 * 4. Executes tool calls locally when stream ends
 * 5. Returns messages to append for conversation continuation
 *
 * @param request - The backend request result containing reader and decoder.
 * @param options - Processing options including writer and callbacks.
 *
 * @returns Promise resolving to processing result.
 *
 * @throws If an error event is received from the backend.
 *
 * @example
 * ```typescript
 * const result = await processStream(
 *     { reader, decoder },
 *     {
 *         writer,
 *         toolNameMapping,
 *         searchEnabled,
 *         onToolCall,
 *         onToolResult,
 *     }
 * );
 *
 * if (result.hasToolCalls || result.hasToolErrors) {
 *     conversationMessages.push(...result.messagesToAppend);
 *     // Continue the loop
 * }
 * ```
 */
export async function processStream(
    request: BackendRequestResult,
    options: StreamProcessorOptions
): Promise<StreamProcessingResult> {
    const { reader, decoder } = request;
    const { writer, toolNameMapping, searchEnabled, abortSignal, onToolCall, onToolResult } = options;

    // Generate a consistent message ID for this response
    const messageId = 'msg-' + generateId();

    // Initialize processing state
    const state: EventProcessingState = {
        hasStartedText: false,
        accumulatedText: '',
        pendingToolCalls: [],
        pendingToolErrors: [],
    };

    // Create event handler context
    const context: EventHandlerContext = {
        writer,
        toolNameMapping,
        searchEnabled,
        onToolCall,
        onToolResult,
        messageId,
    };

    // Process the stream
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Debug: Log raw chunk from backend
        console.log('[BACKEND-DEBUG] Raw chunk received:', chunk);

        const events = parseStreamChunk(chunk);

        log.info('🔍 [STREAM DEBUG] Events from chunk:', {
            eventCount: events.length,
            types: events.map(e => e.type),
        });

        for (const event of events) {
            processEvent(event, context, state);
        }
    }

    // Send text-end if we sent any text
    if (state.hasStartedText) {
        log.info('🔍 [STREAM DEBUG] Sending text-end:', {
            messageId,
            accumulatedLength: state.accumulatedText.length,
        });
        writer.write({
            type: 'text-end',
            id: messageId,
        });
    }

    // Handle tool errors (and no successful calls) - add feedback for AI self-correction
    if (state.pendingToolErrors.length > 0 && state.pendingToolCalls.length === 0) {
        const errorMessages = buildErrorFeedbackMessages(state.pendingToolErrors);
        return {
            hasToolCalls: false,
            hasToolErrors: true,
            messagesToAppend: errorMessages,
        };
    }

    // Handle tool calls - execute locally and format results
    if (state.pendingToolCalls.length > 0) {
        const { messagesToAppend } = await executeToolsAndFormat(
            state.pendingToolCalls,
            state.accumulatedText,
            writer,
            abortSignal,
            onToolResult
        );

        return {
            hasToolCalls: true,
            hasToolErrors: false,
            messagesToAppend,
        };
    }

    // No tool calls or errors - we're done
    return {
        hasToolCalls: false,
        hasToolErrors: false,
        messagesToAppend: [],
    };
}

/**
 * Writes a max steps warning to the stream.
 *
 * @param writer - Stream writer.
 *
 * @remarks
 * UIMessageStream requires text-start -> text-delta -> text-end for a given id.
 * This function properly formats the warning message.
 */
export function writeMaxStepsWarning(writer: UIMessageStreamWriter): void {
    log.warn('Max steps reached, stopping tool execution loop');

    const warningId = 'warning-' + generateId();
    writer.write({ type: 'text-start', id: warningId });
    writer.write({
        type: 'text-delta',
        id: warningId,
        delta: '\n\n⚠️ Maximum tool execution steps reached.',
    });
    writer.write({ type: 'text-end', id: warningId });
}

/**
 * Writes a status event to the stream.
 *
 * @param writer - Stream writer.
 * @param status - Status value ('processing', 'completed', 'aborted').
 *
 * @remarks
 * Status events are transient and used for UI progress indication.
 */
export function writeStatus(
    writer: UIMessageStreamWriter,
    status: 'processing' | 'completed' | 'aborted'
): void {
    writer.write({
        type: 'data-status',
        id: 'status-' + generateId(),
        data: { status, timestamp: Date.now() },
        transient: true,
    });
}
