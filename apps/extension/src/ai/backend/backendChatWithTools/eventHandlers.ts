/**
 * Backend Chat with Tools - Event Handlers
 *
 * Handlers for individual stream event types from the backend.
 * Each handler processes a specific event type and updates the stream/state accordingly.
 *
 * @module backendChatWithTools/eventHandlers
 */

import { createLogger } from '~logger';
import type { UIMessageStreamWriter } from 'ai';
import type { ToolCall, ToolResult } from '../frontendToolExecutor';
import { SERVER_EXECUTED_TOOLS } from '../frontendToolExecutor';
import { TOOLS_REQUIRING_APPROVAL } from '../../setup/remoteMode';
import { isMcpTool, isWebmcpTool } from '../../tools/mcpApprovalConfig';
import { mapToolNameBack } from './toolNameSanitizer';
import type { ToolErrorInfo, ParsedStreamEvent } from './types';

const log = createLogger('EventHandlers', 'AI_CHAT_BACKEND');

/**
 * Context passed to event handlers containing shared state and callbacks.
 */
export interface EventHandlerContext {
    /**
     * Stream writer for sending events to the UI.
     */
    writer: UIMessageStreamWriter;

    /**
     * Mapping from sanitized tool names back to original names.
     */
    toolNameMapping: Record<string, string>;

    /**
     * Whether search mode is enabled (affects server-executed tool handling).
     */
    searchEnabled?: boolean;

    /**
     * Callback when a tool call is received.
     */
    onToolCall?: (toolCall: ToolCall) => void;

    /**
     * Callback when a tool result is received.
     */
    onToolResult?: (result: ToolResult) => void;

    /**
     * Current message ID for text streaming.
     */
    messageId: string;
}

/**
 * Mutable state tracked during event processing.
 */
export interface EventProcessingState {
    /**
     * Whether text-start has been sent for the current message.
     */
    hasStartedText: boolean;

    /**
     * Accumulated text content from text-delta events.
     */
    accumulatedText: string;

    /**
     * Tool calls pending local execution.
     */
    pendingToolCalls: ToolCall[];

    /**
     * Tool errors for AI feedback loop.
     */
    pendingToolErrors: ToolErrorInfo[];
}

/**
 * Result of processing all events in a stream chunk.
 */
export interface EventProcessingResult {
    /**
     * Whether text content was sent during processing.
     */
    hasText: boolean;

    /**
     * Whether an error occurred that should stop processing.
     */
    shouldStop: boolean;

    /**
     * Error that caused processing to stop, if any.
     */
    error?: Error;
}

/**
 * Handles a text event from the stream.
 *
 * @param event - The parsed text event.
 * @param context - Handler context with writer and message ID.
 * @param state - Mutable processing state.
 *
 * @remarks
 * Sends `text-start` on first text chunk, then streams `text-delta` events.
 * The accumulated text is stored in state for later use in tool call messages.
 */
export function handleTextEvent(
    event: ParsedStreamEvent,
    context: EventHandlerContext,
    state: EventProcessingState
): void {
    const { writer, messageId } = context;

    // Send text-start if this is the first text chunk
    if (!state.hasStartedText) {
        log.info('🔍 [STREAM DEBUG] Sending text-start:', { messageId });
        writer.write({
            type: 'text-start',
            id: messageId,
        });
        state.hasStartedText = true;
    }

    state.accumulatedText += event.data;
    log.info('🔍 [STREAM DEBUG] Writing text-delta:', {
        text: event.data,
        accumulatedLength: state.accumulatedText.length,
        messageId,
    });

    writer.write({
        type: 'text-delta',
        id: messageId,
        delta: event.data,
    });
}

/**
 * Handles a tool_call event from the stream.
 *
 * @param event - The parsed tool call event.
 * @param context - Handler context with writer and callbacks.
 * @param state - Mutable processing state to add pending tool calls.
 *
 * @remarks
 * This function:
 * 1. Maps sanitized tool names back to originals
 * 2. Identifies server-executed vs local-executed tools
 * 3. Checks if tools require human approval (HITL pattern)
 * 4. Writes `tool-input-available` for UI display
 * 5. Adds approved tools to pending queue for local execution
 */
export function handleToolCallEvent(
    event: ParsedStreamEvent,
    context: EventHandlerContext,
    state: EventProcessingState
): void {
    const { writer, toolNameMapping, searchEnabled, onToolCall } = context;

    // Map sanitized name back to original name for execution
    const originalName = mapToolNameBack(event.data.name, toolNameMapping);

    if (event.data.name !== originalName) {
        log.info('🔧 Mapping tool call name back:', {
            receivedName: event.data.name,
            originalName,
        });
    }

    const toolCall: ToolCall = {
        id: event.data.id,
        name: originalName,
        arguments: event.data.arguments,
    };

    // Check if this is a server-executed tool (backend handles execution)
    const isServerExecuted = searchEnabled && SERVER_EXECUTED_TOOLS.includes(toolCall.name);

    if (isServerExecuted) {
        // Server-executed tool - backend will send tool-output-available
        // Just show in UI, don't add to pendingToolCalls
        log.info('🔄 Server-executed tool (backend will send result):', {
            name: toolCall.name,
            id: toolCall.id,
        });
        onToolCall?.(toolCall);
        writer.write({
            type: 'tool-input-available',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            input: toolCall.arguments,
        });
        return;
    }

    // Check if tool requires human approval (HITL pattern)
    // Built-in tools: check TOOLS_REQUIRING_APPROVAL
    // MCP/WebMCP tools: ALL require approval
    const isMcp = isMcpTool(toolCall.name);
    const isWebmcp = isWebmcpTool(toolCall.name);
    const isBuiltinApproval = TOOLS_REQUIRING_APPROVAL.includes(toolCall.name);
    const requiresApproval = isMcp || isWebmcp || isBuiltinApproval;

    if (!requiresApproval) {
        // Safe tool - add to pending for auto-execution
        state.pendingToolCalls.push(toolCall);
    } else {
        log.info('🛡️ Tool requires human approval:', {
            name: toolCall.name,
            id: toolCall.id,
            reason: isMcp ? 'MCP tool' : isWebmcp ? 'WebMCP tool' : 'built-in approval',
        });
    }

    onToolCall?.(toolCall);

    log.info('Tool call received:', {
        id: toolCall.id,
        name: toolCall.name,
        requiresApproval,
    });

    // Write structured tool-input-available event for proper UI rendering
    // This is written for ALL tools so UI can display them
    writer.write({
        type: 'tool-input-available',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        input: toolCall.arguments,
    });
}

/**
 * Handles a tool_result event from the stream (server-executed tools).
 *
 * @param event - The parsed tool result event.
 * @param context - Handler context with writer and callbacks.
 *
 * @remarks
 * This is called when the backend has executed a server-side tool (like web-search)
 * and sends the result back. The result is forwarded to the UI to update the tool card.
 */
export function handleToolResultEvent(
    event: ParsedStreamEvent,
    context: EventHandlerContext
): void {
    const { writer, onToolResult } = context;
    const resultData = event.data;

    log.info('🔄 Server tool result received:', {
        toolCallId: resultData.toolCallId,
        hasOutput: !!resultData.output,
    });

    // Write tool-output-available to UI stream
    writer.write({
        type: 'tool-output-available',
        toolCallId: resultData.toolCallId,
        output: resultData.output,
    });

    // Also notify callback if provided
    if (onToolResult) {
        onToolResult({
            id: resultData.toolCallId,
            result: resultData.output,
            isError: false,
        });
    }
}

/**
 * Handles a tool_error event from the stream.
 *
 * @param event - The parsed tool error event.
 * @param context - Handler context with writer and name mapping.
 * @param state - Mutable processing state to track errors.
 *
 * @remarks
 * This is called when the backend reports a tool was unavailable or failed.
 * The error is:
 * 1. Displayed in the UI via tool-output-available
 * 2. Added to pending errors for AI self-correction feedback loop
 */
export function handleToolErrorEvent(
    event: ParsedStreamEvent,
    context: EventHandlerContext,
    state: EventProcessingState
): void {
    const { writer, toolNameMapping } = context;
    const errorData = event.data;

    // Map name back for consistent UI
    const errOriginalName = mapToolNameBack(errorData.name, toolNameMapping);

    log.warn('🔧 Backend reports tool error:', {
        toolName: errOriginalName,
        errorText: errorData.errorText,
    });

    // Write tool events to UI for visual feedback
    writer.write({
        type: 'tool-input-available',
        toolCallId: errorData.id,
        toolName: errOriginalName,
        input: errorData.input,
    });

    writer.write({
        type: 'tool-output-available',
        toolCallId: errorData.id,
        output: {
            error: true,
            message: errorData.errorText,
            feedback: errorData.errorText,
        },
    });

    // Track error for AI feedback loop (include name and input for proper message)
    state.pendingToolErrors.push({
        id: errorData.id,
        name: errOriginalName,
        input: errorData.input,
        result: errorData.errorText,
    });
}

/**
 * Handles an error event from the stream.
 *
 * @param event - The parsed error event.
 * @throws Always throws an error with the message from the event.
 *
 * @remarks
 * Error events from the backend are fatal and should stop processing.
 */
export function handleErrorEvent(event: ParsedStreamEvent): never {
    log.error('Stream error:', event.data);
    throw new Error(event.data.message || 'Stream error from backend');
}

/**
 * Handles a finish event from the stream.
 *
 * @remarks
 * This is informational only - indicates the backend has finished sending.
 */
export function handleFinishEvent(): void {
    log.info('Stream finished signal received');
}

/**
 * Processes a single stream event and routes to the appropriate handler.
 *
 * @param event - The parsed stream event.
 * @param context - Handler context.
 * @param state - Mutable processing state.
 *
 * @throws If the event is an error type.
 */
export function processEvent(
    event: ParsedStreamEvent,
    context: EventHandlerContext,
    state: EventProcessingState
): void {
    log.info('🔍 [STREAM DEBUG] Processing event:', {
        type: event.type,
        hasData: !!event.data,
    });

    switch (event.type) {
        case 'text':
            handleTextEvent(event, context, state);
            break;

        case 'tool_call':
            handleToolCallEvent(event, context, state);
            break;

        case 'tool_result':
            handleToolResultEvent(event, context);
            break;

        case 'tool_error':
            handleToolErrorEvent(event, context, state);
            break;

        case 'error':
            handleErrorEvent(event);
            break;

        case 'finish':
            handleFinishEvent();
            break;

        case 'text_start':
        case 'text_end':
            // These are handled by our manual hasStartedText logic
            // Ignore the events from the parser
            break;
    }
}
