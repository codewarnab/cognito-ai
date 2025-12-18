/**
 * Backend Chat with Frontend Tools
 * 
 * Handles the full tool execution loop:
 * 1. Send message + tool schemas to backend
 * 2. Stream response, intercepting tool calls
 * 3. Execute tools locally
 * 4. Send results back to continue generation
 */

import { createUIMessageStream, generateId, type UIMessage } from 'ai';
import { createLogger } from '~logger';
import {
    executeToolLocally,
    getToolSchemas,
    type ToolCall,
    type ToolResult,
} from './frontendToolExecutor';
import { createBackendController, clearBackendController } from './streamingOptimizations';
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
    abortSignal?: AbortSignal;
    onError?: (error: Error) => void;
    onFinishCallback?: () => void;
    onToolCall?: (toolCall: ToolCall) => void;
    onToolResult?: (result: ToolResult) => void;
    // TODO: Add search mode support - pass searchEnabled and searchDepth to backend
    // TODO: Add page context support - pass initialPageContext to backend  
    // TODO: Add workflow support - pass workflowId for workflow-specific prompts
}

/**
 * Parse AI SDK stream format
 * Returns parsed events from the stream chunk
 */
function parseStreamChunk(chunk: string): Array<{
    type: 'text' | 'tool_call' | 'tool_result' | 'finish' | 'error' | 'unknown';
    data: any;
}> {
    const events: Array<{ type: any; data: any }> = [];

    log.info('🔍 [STREAM DEBUG] Parsing chunk:', {
        chunkLength: chunk.length,
        chunkPreview: chunk.substring(0, 200),
        lineCount: chunk.split('\n').length,
    });
    const lines = chunk.split('\n');

    for (const line of lines) {
        if (!line.trim()) continue;

        try {
            // AI SDK stream format: prefix:json_data
            // 0: text delta
            // 2: data message (metadata)
            // 3: error
            // 9: tool call
            // a: tool result
            // b: step finish
            // c: step start
            // d: finish/done (final message)
            // e: step finish event (finishReason, usage) - NOT error!
            // f: message start
            if (line.startsWith('0:')) {
                // Text delta
                const text = JSON.parse(line.slice(2));
                log.info('🔍 [STREAM DEBUG] Text delta parsed:', { text });
                events.push({ type: 'text', data: text });
            } else if (line.startsWith('9:')) {
                // Tool call - format: {"toolCallId":"xxx","toolName":"xxx","args":{...}}
                const toolCallData = JSON.parse(line.slice(2));
                events.push({
                    type: 'tool_call',
                    data: {
                        id: toolCallData.toolCallId,
                        name: toolCallData.toolName,
                        arguments: toolCallData.args,
                    },
                });
            } else if (line.startsWith('a:')) {
                // Tool result
                const resultData = JSON.parse(line.slice(2));
                events.push({ type: 'tool_result', data: resultData });
            } else if (line.startsWith('3:')) {
                // Error - only '3:' prefix is for errors in AI SDK
                try {
                    const errorData = JSON.parse(line.slice(2));
                    events.push({ type: 'error', data: errorData });
                } catch {
                    events.push({ type: 'error', data: { message: line.slice(2) } });
                }
            } else if (line.startsWith('d:') || line.startsWith('e:')) {
                // Finish/done signal
                // 'd:' = final message finish
                // 'e:' = step finish event (contains finishReason, usage, isContinued)
                // Both indicate successful completion, NOT errors
                try {
                    const finishData = JSON.parse(line.slice(2));
                    log.info('🔍 [STREAM DEBUG] Finish event parsed:', { prefix: line[0], finishData });
                    events.push({ type: 'finish', data: finishData });
                } catch {
                    log.info('🔍 [STREAM DEBUG] Finish event (no data):', { prefix: line[0] });
                    events.push({ type: 'finish', data: null });
                }
            } else if (line.startsWith('f:')) {
                // Message start - contains messageId
                log.info('🔍 [STREAM DEBUG] Message start:', line.slice(2));
            } else if (line.startsWith('2:')) {
                // Data message (metadata)
                log.debug('Data message:', line.slice(2));
            } else if (line.startsWith('b:')) {
                // Step finish
                log.debug('Step finish:', line.slice(2));
            } else if (line.startsWith('c:')) {
                // Step start
                log.debug('Step start:', line.slice(2));
            } else {
                // Unknown format
                log.debug('Unknown stream line format:', line.substring(0, 50));
            }
        } catch (e) {
            log.warn('Failed to parse stream line:', line.substring(0, 100));
        }
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
        abortSignal,
        onError,
        onFinishCallback,
        onToolCall,
        onToolResult,
    } = params;

    log.info('Starting backend chat with tools', { messageCount: messages.length, model, mode });

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

                    // Convert UIMessages to simple format for backend
                    // UIMessage uses 'parts' array, extract text from text parts
                    const simpleMessages = messages
                        .map((msg) => {
                            let textContent = '';
                            if (msg.parts && Array.isArray(msg.parts)) {
                                textContent = msg.parts
                                    .filter((part: any) => part && part.type === 'text')
                                    .map((part: any) => part.text || '')
                                    .join('');
                            }
                            return {
                                role: msg.role,
                                content: textContent,
                            };
                        })
                        .filter((msg) => msg.content.length > 0);

                    // Tool execution loop
                    let conversationMessages = [...simpleMessages];
                    let continueLoop = true;
                    let stepCount = 0;
                    const maxSteps = 10;

                    while (continueLoop && stepCount < maxSteps) {
                        stepCount++;
                        log.info(`Step ${stepCount}: Sending to backend`, {
                            messageCount: conversationMessages.length,
                        });

                        // Make request to backend
                        const response = await fetch(
                            `${BACKEND_URL}/api/ai/chat-with-tools`,
                            {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Connection': 'keep-alive',
                                },
                                body: JSON.stringify({
                                    messages: conversationMessages,
                                    system: systemPrompt,
                                    tools: toolSchemas,
                                    model, // Use selected model
                                    mode, // Send mode so backend can use appropriate prompt
                                    maxSteps: 1, // One step at a time for tool execution
                                    // TODO: Add searchEnabled, searchDepth for search mode
                                    // TODO: Add pageContext for initial page context
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
                        let accumulatedText = '';

                        // Generate a consistent message ID for this response
                        const messageId = 'msg-' + generateId();
                        let hasStartedText = false;

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            const chunk = decoder.decode(value, { stream: true });
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

                                        // Write tool call info as text for UI visibility
                                        if (!hasStartedText) {
                                            writer.write({
                                                type: 'text-start',
                                                id: messageId,
                                            });
                                            hasStartedText = true;
                                        }
                                        writer.write({
                                            type: 'text-delta',
                                            id: messageId,
                                            delta: `\n🔧 Calling tool: **${toolCall.name}**\n`,
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

                                // Write tool result info as text for UI visibility
                                const resultPreview = result.isError
                                    ? `❌ Error: ${result.result}`
                                    : `✅ Done`;
                                writer.write({
                                    type: 'text-delta',
                                    id: 'tool-result-' + generateId(),
                                    delta: `${resultPreview}\n`,
                                });
                            }

                            // Add assistant message with tool calls to conversation
                            conversationMessages.push({
                                role: 'assistant',
                                content: accumulatedText || '',
                                // Include tool calls in the message
                                tool_calls: pendingToolCalls.map((tc) => ({
                                    id: tc.id,
                                    type: 'function',
                                    function: {
                                        name: tc.name,
                                        arguments: JSON.stringify(tc.arguments),
                                    },
                                })),
                            } as any);

                            // Add tool results as tool messages
                            for (const result of toolResults) {
                                conversationMessages.push({
                                    role: 'tool',
                                    content: JSON.stringify(result.result),
                                    tool_call_id: result.id,
                                } as any);
                            }

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

                    const errorMessage =
                        error instanceof Error ? error.message : 'Unknown error';

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

                    // Write error to stream
                    writer.write({
                        type: 'text-delta',
                        id: 'error-' + generateId(),
                        delta: `\n\n❌ **Error:** ${errorMessage}\n\nPlease try again or switch to BYOK mode with your own API key.`,
                    });

                    // Send error status
                    writer.write({
                        type: 'data-status',
                        id: 'status-' + generateId(),
                        data: { status: 'error', timestamp: Date.now() },
                        transient: false,
                    });

                    onError?.(
                        error instanceof Error ? error : new Error(errorMessage)
                    );
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
