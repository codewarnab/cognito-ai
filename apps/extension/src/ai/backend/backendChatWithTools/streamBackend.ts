/**
 * Backend Chat with Frontend Tools - Main Stream Function
 *
 * Orchestrates the full tool execution loop for backend-powered AI chat:
 * 1. Prepare tool schemas and send to backend
 * 2. Stream response, intercepting tool calls
 * 3. Execute tools locally
 * 4. Send results back to continue generation
 *
 * This is the main entry point for backend chat with tools functionality.
 *
 * @module backendChatWithTools/streamBackend
 */

import { createUIMessageStream, convertToModelMessages, type ModelMessage } from 'ai';
import { createLogger } from '~logger';
import { createBackendController, clearBackendController } from '../streamingOptimizations';
import { writeErrorToStream } from '../../stream/streamHelpers';
import { parseGeminiError } from '../../errors/handlers';
import { BaseAppError } from '../../../errors/errorTypes';

import type { BackendChatWithToolsParams } from './types';
import { DEFAULT_MAX_STEPS, DEFAULT_MODE } from './constants';
import { prepareTools } from './prepareTool';
import { makeBackendRequest } from './requestHandler';
import { sanitizeMessagesForBackend } from './messageSanitizer';
import {
    processStream,
    writeMaxStepsWarning,
    writeStatus,
} from './streamProcessor';

const log = createLogger('BackendChatWithTools', 'AI_CHAT_BACKEND');

/**
 * Streams an AI response through the backend with frontend tool execution.
 *
 * This function implements a client-side tool execution loop:
 * 1. Sends conversation + tool schemas to the backend
 * 2. Streams the response and intercepts tool calls
 * 3. Executes tools locally when the AI requests them
 * 4. Sends tool results back to the backend for continuation
 * 5. Repeats until no more tool calls or max steps reached
 *
 * @param params - Configuration parameters for the chat stream.
 *
 * @returns A readable stream of UI message events for the chat interface.
 *
 * @throws If the backend request fails or stream processing errors.
 *
 * @example
 * ```typescript
 * const stream = await streamBackendChatWithTools({
 *     messages: chatMessages,
 *     systemPrompt: 'You are a helpful assistant.',
 *     mode: 'agent',
 *     maxSteps: 20,
 *     searchEnabled: true,
 *     onToolCall: (tc) => console.log('Tool called:', tc.name),
 *     onToolResult: (result) => console.log('Tool result:', result.id),
 *     onFinishCallback: () => console.log('Stream completed'),
 * });
 *
 * // Consume the stream
 * for await (const chunk of stream) {
 *     // Handle chunk...
 * }
 * ```
 *
 * @remarks
 * **Backend Mode**: The backend uses a fixed model (gemini-2.5-flash).
 * Model selection is not supported in backend mode.
 *
 * **Server-Executed Tools**: When `searchEnabled` or `youtubeEnabled` is true,
 * those tools are executed server-side and results are streamed back.
 *
 * **Tool Approval**: Some tools require human approval (HITL pattern).
 * MCP tools, WebMCP tools, and certain built-in tools will not be auto-executed.
 */
export async function streamBackendChatWithTools(
    params: BackendChatWithToolsParams
) {
    const {
        messages,
        systemPrompt,
        mode = DEFAULT_MODE,
        maxSteps: userMaxSteps = DEFAULT_MAX_STEPS,
        abortSignal,
        onError,
        onFinishCallback,
        onToolCall,
        onToolResult,
        initialPageContext,
        searchEnabled,
        youtubeEnabled,
    } = params;

    log.info('Starting backend chat with tools', {
        messageCount: messages.length,
        mode,
        hasPageContext: !!initialPageContext,
        pageContextLength: initialPageContext?.length || 0,
        searchEnabled: !!searchEnabled,
    });

    // Create abort controller for this request
    const controller = createBackendController();

    try {
        // Prepare tool schemas for backend
        const { sanitizedSchemas, toolNameMapping, toolCount } = await prepareTools(searchEnabled);
        log.info('Tools prepared', { toolCount });

        const stream = createUIMessageStream({
            execute: async ({ writer }) => {
                try {
                    // Send initial processing status
                    writeStatus(writer, 'processing');

                    // Convert UIMessages to ModelMessages to preserve full history
                    const rawMessages = await convertToModelMessages(messages);

                    // Sanitize messages to fix malformed conversation structure
                    const initialMessages = sanitizeMessagesForBackend(rawMessages);

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

                        // Make request to backend
                        const request = await makeBackendRequest({
                            messages: conversationMessages,
                            systemPrompt,
                            tools: sanitizedSchemas,
                            mode,
                            maxSteps: 1, // One step at a time for tool execution
                            pageContext: stepCount === 1 ? initialPageContext : undefined,
                            searchEnabled,
                            youtubeEnabled,
                            signal: abortSignal || controller.signal,
                        });

                        // Process the streaming response
                        const result = await processStream(request, {
                            writer,
                            toolNameMapping,
                            searchEnabled,
                            abortSignal,
                            onToolCall,
                            onToolResult,
                        });

                        // Handle tool execution continuation
                        if (result.hasToolCalls || result.hasToolErrors) {
                            conversationMessages.push(...result.messagesToAppend);
                            // Continue loop for more generation
                        } else {
                            // No tool calls, we're done
                            continueLoop = false;
                        }
                    }

                    if (stepCount >= maxSteps) {
                        writeMaxStepsWarning(writer);
                    }

                    // Send completion status
                    writeStatus(writer, 'completed');

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
                        writeStatus(writer, 'aborted');
                        return;
                    }

                    // Parse error into our error types for consistent UX
                    const appError = error instanceof BaseAppError
                        ? error
                        : parseGeminiError(error);

                    // Write unified error to stream
                    writeErrorToStream(writer, appError, 'Backend chat');
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
