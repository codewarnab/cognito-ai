/**
 * Backend Chat with Frontend Tools
 * 
 * Handles the full tool execution loop:
 * 1. Send message + tool schemas to backend
 * 2. Stream response, intercepting tool calls
 * 3. Execute tools locally
 * 4. Send results back to continue generation
 */

import { createUIMessageStream, generateId, type UIMessage, convertToModelMessages, type ModelMessage } from 'ai';
import { createLogger } from '~logger';
import {
    executeToolLocally,
    getToolSchemas,
    type ToolCall,
    type ToolResult,
} from './frontendToolExecutor';
import { createBackendController, clearBackendController } from './streamingOptimizations';
import { writeErrorToStream } from '../stream/streamHelpers';
import { parseGeminiError } from '../errors/handlers';
import { APIError, NetworkError } from '../../errors/errorTypes';
import type { BackendModel } from '@/stores/settings/types';
import type { ToolMode } from '@/stores/tools/types';
import { ENV } from '@/utils/env';

const log = createLogger('BackendChatWithTools', 'AI_CHAT');

// Backend API URL from centralized ENV
const BACKEND_URL = ENV.BACKEND_API_URL;

export interface BackendChatWithToolsParams {
    messages: UIMessage[];
    systemPrompt?: string;
    model?: BackendModel;
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
    // TODO: Add search mode support - pass searchEnabled and searchDepth to backend
    // TODO: Add workflow support - pass workflowId for workflow-specific prompts
}

/**
 * Parse AI SDK v5 UI Message Stream format (SSE only)
 * 
 * Format: data: {"type":"...", ...}
 * 
 * Supported types:
 * - start: Message start with messageId
 * - text-start/text-delta/text-end: Text streaming
 * - tool-input-available: Complete tool call ready for execution
 * - tool-output-available: Tool result
 * - finish/finish-step: Stream completion
 * - error: Stream error
 */
function parseStreamChunk(chunk: string): Array<{
    type: 'text' | 'text_start' | 'text_end' | 'tool_call' | 'tool_result' | 'tool_error' | 'finish' | 'error';
    data: any;
}> {
    const events: Array<{ type: any; data: any }> = [];
    const lines = chunk.split('\n');

    for (const line of lines) {
        if (!line.trim()) continue;

        // AI SDK v5 SSE format: "data: {...}"
        if (line.startsWith('data: ')) {
            const dataContent = line.slice(6);

            // Stream termination marker
            if (dataContent === '[DONE]') {
                events.push({ type: 'finish', data: { done: true } });
                continue;
            }

            try {
                const parsed = JSON.parse(dataContent);
                const eventType = parsed.type;

                switch (eventType) {
                    case 'text-start':
                        events.push({ type: 'text_start', data: { id: parsed.id } });
                        break;

                    case 'text-delta':
                        events.push({ type: 'text', data: parsed.delta });
                        break;

                    case 'text-end':
                        events.push({ type: 'text_end', data: { id: parsed.id } });
                        break;

                    case 'tool-input-available':
                        events.push({
                            type: 'tool_call',
                            data: {
                                id: parsed.toolCallId,
                                name: parsed.toolName,
                                arguments: parsed.input,
                            },
                        });
                        break;

                    case 'tool-output-available':
                        events.push({ type: 'tool_result', data: parsed });
                        break;

                    case 'tool-input-error':
                        // Backend reports tool was unavailable/invalid
                        events.push({
                            type: 'tool_error',
                            data: {
                                id: parsed.toolCallId,
                                name: parsed.toolName,
                                input: parsed.input,
                                errorText: parsed.errorText,
                            },
                        });
                        break;

                    case 'tool-output-error':
                        // This follows tool-input-error with same info
                        // tool_error from tool-input-error is sufficient
                        break;

                    case 'error':
                        log.error('Stream error:', parsed);
                        events.push({ type: 'error', data: { message: parsed.errorText || 'Unknown error' } });
                        break;

                    case 'finish':
                    case 'finish-step':
                        events.push({ type: 'finish', data: parsed });
                        break;

                    // Ignore other event types (start, start-step, reasoning-*, source-*, file, etc.)
                    default:
                        break;
                }
            } catch (e) {
                // Ignore unparseable lines
            }
        }
        // Ignore SSE comments/pings (lines starting with :)
    }

    return events;
}

/**
 * Stream AI response through backend with frontend tool execution
 */
export async function streamBackendChatWithTools(
    params: BackendChatWithToolsParams
) {
    const {
        messages,
        systemPrompt,
        model = 'gemini-2.5-flash',
        mode = 'agent', // Default to agent mode for full tool access
        maxSteps: userMaxSteps = 20, // Default to 10 if not specified
        abortSignal,
        onError,
        onFinishCallback,
        onToolCall,
        onToolResult,
        initialPageContext,
    } = params;

    log.info('Starting backend chat with tools', {
        messageCount: messages.length,
        model,
        mode,
        hasPageContext: !!initialPageContext,
        pageContextLength: initialPageContext?.length || 0,
    });

    // Create abort controller for this request
    const controller = createBackendController();

    try {
        // Get tool schemas to send to backend
        const toolSchemas = await getToolSchemas();
        const toolCount = Object.keys(toolSchemas).length;
        log.info('Tool schemas prepared', { toolCount });

        const stream = createUIMessageStream({
            execute: async ({ writer }) => {
                try {
                    // Send initial processing status
                    writer.write({
                        type: 'data-status',
                        id: 'status-' + generateId(),
                        data: { status: 'processing', timestamp: Date.now() },
                        transient: true,
                    });

                    // Convert UIMessages to ModelMessages to preserve full history including tool invocations
                    // This fixes the issue where previous tool calls were dropped/malformed
                    // Note: convertToModelMessages is async in AI SDK 6
                    const initialMessages = await convertToModelMessages(messages);

                    // Tool execution loop
                    let conversationMessages: ModelMessage[] = [...initialMessages];
                    let continueLoop = true;
                    let stepCount = 0;
                    const maxSteps = userMaxSteps;

                    while (continueLoop && stepCount < maxSteps) {
                        stepCount++;
                        log.info(`Step ${stepCount}: Sending to backend`, {
                            messageCount: conversationMessages.length,
                        });

                        // Debug: Log the full messages structure for debugging
                        console.log('[BACKEND-DEBUG] Messages being sent:', JSON.stringify(conversationMessages, null, 2));

                        // Make request to backend
                        const response = await fetch(
                            `${BACKEND_URL}/api/ai/chat-with-tools`,
                            {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Connection': 'keep-alive',
                                    'Accept': 'text/event-stream',
                                },
                                body: JSON.stringify({
                                    messages: conversationMessages,
                                    system: systemPrompt,
                                    tools: toolSchemas,
                                    model, // Use selected model
                                    mode, // Send mode so backend can use appropriate prompt
                                    maxSteps: 1, // One step at a time for tool execution
                                    pageContext: initialPageContext, // Page context for page-aware conversations
                                    // TODO: Add searchEnabled, searchDepth for search mode
                                }),
                                signal: abortSignal || controller.signal,
                            }
                        );

                        if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            throw new Error(
                                errorData.message || `Backend error: ${response.status}`
                            );
                        }

                        if (!response.body) {
                            throw new Error('No response body from backend');
                        }

                        // Process streaming response
                        const reader = response.body.getReader();
                        const decoder = new TextDecoder();
                        const pendingToolCalls: ToolCall[] = [];
                        // Track tool errors for feedback loop (extended info for proper messages)
                        const pendingToolErrors: Array<{ id: string; name: string; input: any; result: string }> = [];
                        let accumulatedText = '';

                        // Generate a consistent message ID for this response
                        const messageId = 'msg-' + generateId();
                        let hasStartedText = false;

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            const chunk = decoder.decode(value, { stream: true });

                            // Debug: Log raw chunk from backend
                            console.log('[BACKEND-DEBUG] Raw chunk received:', chunk);

                            const events = parseStreamChunk(chunk);

                            log.info('🔍 [STREAM DEBUG] Events from chunk:', { eventCount: events.length, types: events.map(e => e.type) });

                            for (const event of events) {
                                log.info('🔍 [STREAM DEBUG] Processing event:', { type: event.type, hasData: !!event.data });

                                switch (event.type) {
                                    case 'text':
                                        // Send text-start if this is the first text chunk
                                        if (!hasStartedText) {
                                            log.info('🔍 [STREAM DEBUG] Sending text-start:', { messageId });
                                            writer.write({
                                                type: 'text-start',
                                                id: messageId,
                                            });
                                            hasStartedText = true;
                                        }

                                        accumulatedText += event.data;
                                        log.info('🔍 [STREAM DEBUG] Writing text-delta:', { text: event.data, accumulatedLength: accumulatedText.length, messageId });
                                        writer.write({
                                            type: 'text-delta',
                                            id: messageId, // Use same ID for all deltas
                                            delta: event.data,
                                        });
                                        break;

                                    case 'tool_call':
                                        const toolCall: ToolCall = {
                                            id: event.data.id,
                                            name: event.data.name,
                                            arguments: event.data.arguments,
                                        };
                                        pendingToolCalls.push(toolCall);
                                        onToolCall?.(toolCall);

                                        log.info('Tool call received:', {
                                            id: toolCall.id,
                                            name: toolCall.name,
                                        });

                                        // Write structured tool-input-available event for proper UI rendering
                                        writer.write({
                                            type: 'tool-input-available',
                                            toolCallId: toolCall.id,
                                            toolName: toolCall.name,
                                            input: toolCall.arguments,
                                        });
                                        break;

                                    case 'error':
                                        log.error('Stream error:', event.data);
                                        throw new Error(
                                            event.data.message || 'Stream error from backend'
                                        );

                                    case 'finish':
                                        log.info('Stream finished signal received');
                                        break;

                                    case 'text_start':
                                    case 'text_end':
                                        // These are handled by our manual hasStartedText logic
                                        // Ignore the events from the parser
                                        break;

                                    case 'tool_error':
                                        // Backend reports tool was unavailable
                                        const errorData = event.data;
                                        log.warn('🔧 Backend reports tool error:', {
                                            toolName: errorData.name,
                                            errorText: errorData.errorText,
                                        });

                                        // Write tool events to UI for visual feedback
                                        writer.write({
                                            type: 'tool-input-available',
                                            toolCallId: errorData.id,
                                            toolName: errorData.name,
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
                                        pendingToolErrors.push({
                                            id: errorData.id,
                                            name: errorData.name,
                                            input: errorData.input,
                                            result: errorData.errorText,
                                        });
                                        break;
                                }
                            }
                        }

                        // Send text-end if we sent any text
                        if (hasStartedText) {
                            log.info('🔍 [STREAM DEBUG] Sending text-end:', { messageId, accumulatedLength: accumulatedText.length });
                            writer.write({
                                type: 'text-end',
                                id: messageId,
                            });
                        }

                        // If there are tool errors (and no successful calls), add feedback for AI self-correction
                        if (pendingToolErrors.length > 0 && pendingToolCalls.length === 0) {
                            log.info('Adding tool error feedback to conversation for AI self-correction', {
                                errorCount: pendingToolErrors.length,
                            });

                            // Build assistant content with attempted tool calls (same pattern as successful calls)
                            const assistantContent: Array<any> = [];
                            for (const error of pendingToolErrors) {
                                assistantContent.push({
                                    type: 'tool-call',
                                    toolCallId: error.id,
                                    toolName: error.name,
                                    args: error.input || {},
                                });
                            }

                            // Add as assistant message that attempted the tool call
                            conversationMessages.push({
                                role: 'assistant',
                                content: assistantContent,
                            });

                            // Add tool result with error feedback
                            conversationMessages.push({
                                role: 'tool',
                                content: pendingToolErrors.map((error) => ({
                                    type: 'tool-result' as const,
                                    toolCallId: error.id,
                                    toolName: error.name,
                                    output: { type: 'error-text' as const, value: error.result },
                                })) as any,
                            });

                            // Continue loop so AI can retry with correct tools
                            pendingToolErrors.length = 0; // Clear for next iteration
                            accumulatedText = '';
                            continue;
                        }

                        // If there are tool calls, execute them and continue
                        if (pendingToolCalls.length > 0) {
                            log.info(
                                `Executing ${pendingToolCalls.length} tool calls locally`
                            );

                            const toolResults: ToolResult[] = [];

                            for (const toolCall of pendingToolCalls) {
                                // Execute tool locally
                                const result = await executeToolLocally(
                                    toolCall,
                                    abortSignal
                                );
                                toolResults.push(result);
                                onToolResult?.(result);

                                log.info('Tool result:', {
                                    id: result.id,
                                    isError: result.isError,
                                });

                                // Write structured tool-output-available event for proper UI rendering
                                writer.write({
                                    type: 'tool-output-available',
                                    toolCallId: result.id,
                                    output: result.result,
                                });
                            }

                            // Add assistant message with tool calls to conversation
                            // Properly formatted using AI SDK Core Message format
                            const assistantContent: Array<any> = [];
                            if (accumulatedText) {
                                assistantContent.push({ type: 'text', text: accumulatedText });
                            }

                            for (const tc of pendingToolCalls) {
                                assistantContent.push({
                                    type: 'tool-call',
                                    toolCallId: tc.id,
                                    toolName: tc.name,
                                    args: tc.arguments, // Using args as AI SDK v5 convertToModelMessages uses args for tool calls usually
                                });
                            }

                            conversationMessages.push({
                                role: 'assistant',
                                content: assistantContent,
                            });

                            // Add tool results as tool messages
                            // AI SDK v5: ToolResultPart uses 'output' with LanguageModelV2ToolResultOutput format
                            conversationMessages.push({
                                role: 'tool',
                                content: toolResults.map((result) => {
                                    const tc = pendingToolCalls.find(t => t.id === result.id);

                                    const resultValue = typeof result.result === 'string'
                                        ? result.result
                                        : JSON.stringify(result.result);

                                    // AI SDK v5 ToolResultPart format with LanguageModelV2ToolResultOutput
                                    return {
                                        type: 'tool-result' as const,
                                        toolCallId: result.id,
                                        toolName: tc?.name || 'unknown',
                                        // output must be LanguageModelV2ToolResultOutput:
                                        // { type: 'text' | 'json' | 'error-text' | 'error-json', value: ... }
                                        output: result.isError
                                            ? { type: 'error-text' as const, value: resultValue }
                                            : { type: 'text' as const, value: resultValue },
                                    };
                                }) as any,
                            });

                            // Continue the loop for more generation
                            accumulatedText = '';
                        } else {
                            // No tool calls, we're done
                            continueLoop = false;
                        }
                    }

                    if (stepCount >= maxSteps) {
                        log.warn('Max steps reached, stopping tool execution loop');
                        writer.write({
                            type: 'text-delta',
                            id: 'warning-' + generateId(),
                            delta: '\n\n⚠️ Maximum tool execution steps reached.',
                        });
                    }

                    // Send completion status
                    writer.write({
                        type: 'data-status',
                        id: 'status-' + generateId(),
                        data: { status: 'completed', timestamp: Date.now() },
                        transient: true,
                    });

                    // Clear controller on completion
                    clearBackendController();
                    onFinishCallback?.();
                } catch (error) {
                    // Clear controller on error
                    clearBackendController();
                    log.error('Backend chat with tools error:', error);

                    // Check if aborted
                    if (error instanceof Error && error.name === 'AbortError') {
                        log.info('Backend chat was aborted by user');
                        writer.write({
                            type: 'data-status',
                            id: 'status-' + generateId(),
                            data: { status: 'aborted', timestamp: Date.now() },
                            transient: true,
                        });
                        return;
                    }

                    // Parse error into our error types for consistent UX across BYOK and backend modes
                    const appError = error instanceof APIError || error instanceof NetworkError
                        ? error
                        : parseGeminiError(error);

                    // Write unified error to stream
                    writeErrorToStream(writer, appError, 'Backend chat');

                    // Send error status
                    writer.write({
                        type: 'data-status',
                        id: 'status-' + generateId(),
                        data: { status: 'error', timestamp: Date.now() },
                        transient: false,
                    });

                    onError?.(appError);
                }
            },
        });

        return stream;
    } catch (error) {
        log.error('Failed to create backend stream with tools:', error);
        onError?.(
            error instanceof Error ? error : new Error('Failed to start backend chat')
        );
        throw error;
    }
}
