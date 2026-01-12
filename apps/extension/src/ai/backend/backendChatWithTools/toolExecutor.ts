/**
 * Backend Chat with Tools - Tool Executor
 *
 * Handles local execution of tool calls and result processing.
 * Manages the tool execution lifecycle including result formatting.
 *
 * @module backendChatWithTools/toolExecutor
 */

import type { ModelMessage } from 'ai';
import type { UIMessageStreamWriter } from 'ai';
import { createLogger } from '~logger';
import { executeToolLocally, type ToolCall, type ToolResult } from '../frontendToolExecutor';
import type { ToolErrorInfo } from './types';

const log = createLogger('ToolExecutor', 'AI_CHAT_BACKEND');

/**
 * Result of executing pending tool calls.
 */
export interface ToolExecutionResult {
    /**
     * Results from all executed tools.
     */
    results: ToolResult[];

    /**
     * Messages to append to conversation for backend continuation.
     */
    messagesToAppend: ModelMessage[];
}

/**
 * Executes pending tool calls locally and formats results for conversation.
 *
 * This function:
 * 1. Executes each tool call using the local tool executor
 * 2. Writes tool-output-available events to the UI stream
 * 3. Formats the results as AI SDK ModelMessages for conversation continuation
 *
 * @param pendingToolCalls - Array of tool calls to execute.
 * @param accumulatedText - Any text accumulated before the tool calls.
 * @param writer - Stream writer for UI updates.
 * @param abortSignal - Optional abort signal for cancellation.
 * @param onToolResult - Optional callback when each tool result is ready.
 *
 * @returns Promise resolving to execution results and messages to append.
 *
 * @example
 * ```typescript
 * const { results, messagesToAppend } = await executeToolsAndFormat(
 *     pendingToolCalls,
 *     accumulatedText,
 *     writer,
 *     abortSignal,
 *     onToolResult
 * );
 *
 * conversationMessages.push(...messagesToAppend);
 * ```
 */
export async function executeToolsAndFormat(
    pendingToolCalls: ToolCall[],
    accumulatedText: string,
    writer: UIMessageStreamWriter,
    abortSignal?: AbortSignal,
    onToolResult?: (result: ToolResult) => void
): Promise<ToolExecutionResult> {
    log.info(`Executing ${pendingToolCalls.length} tool calls locally`);

    const toolResults: ToolResult[] = [];

    for (const toolCall of pendingToolCalls) {
        // Execute tool locally
        const result = await executeToolLocally(toolCall, abortSignal);
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

    // Build messages to append to conversation
    const messagesToAppend = buildToolResultMessages(
        pendingToolCalls,
        toolResults,
        accumulatedText
    );

    return {
        results: toolResults,
        messagesToAppend,
    };
}

/**
 * Builds AI SDK ModelMessages from tool calls and results.
 *
 * Creates properly formatted assistant and tool messages for the conversation:
 * 1. Assistant message with any text + tool-call parts
 * 2. Tool message with tool-result parts
 *
 * @param toolCalls - The tool calls that were made.
 * @param toolResults - The results from executing the tools.
 * @param accumulatedText - Any text before the tool calls.
 *
 * @returns Array of ModelMessages to append to conversation.
 *
 * @internal
 */
export function buildToolResultMessages(
    toolCalls: ToolCall[],
    toolResults: ToolResult[],
    accumulatedText: string
): ModelMessage[] {
    const messages: ModelMessage[] = [];

    // Build assistant content with tool calls
    // Properly formatted using AI SDK Core Message format
    const assistantContent: Array<
        | { type: 'text'; text: string }
        | { type: 'tool-call'; toolCallId: string; toolName: string; input: Record<string, unknown> }
    > = [];

    if (accumulatedText) {
        assistantContent.push({ type: 'text', text: accumulatedText });
    }

    for (const tc of toolCalls) {
        assistantContent.push({
            type: 'tool-call',
            toolCallId: tc.id,
            toolName: tc.name,
            input: tc.arguments,
        });
    }

    messages.push({
        role: 'assistant',
        content: assistantContent,
    } as ModelMessage);

    // Add tool results as tool messages
    // AI SDK v6: ToolResultPart uses 'output' with LanguageModelV2ToolResultOutput format
    messages.push({
        role: 'tool',
        content: toolResults.map((result) => {
            const tc = toolCalls.find(t => t.id === result.id);

            const resultValue = typeof result.result === 'string'
                ? result.result
                : JSON.stringify(result.result);

            // AI SDK v6 ToolResultPart format with LanguageModelV2ToolResultOutput
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
        }),
    } as ModelMessage);

    return messages;
}

/**
 * Builds error feedback messages for the AI self-correction loop.
 *
 * When tools fail (e.g., unavailable tools), we need to:
 * 1. Create an assistant message showing the attempted tool calls
 * 2. Create a tool message with error results
 * 
 * This allows the AI to understand what went wrong and try a different approach.
 *
 * @param toolErrors - Array of tool errors to include in feedback.
 *
 * @returns Array of ModelMessages for error feedback.
 *
 * @example
 * ```typescript
 * if (pendingToolErrors.length > 0 && pendingToolCalls.length === 0) {
 *     const errorMessages = buildErrorFeedbackMessages(pendingToolErrors);
 *     conversationMessages.push(...errorMessages);
 *     // Continue loop for AI to retry
 * }
 * ```
 */
export function buildErrorFeedbackMessages(
    toolErrors: ToolErrorInfo[]
): ModelMessage[] {
    log.info('Building error feedback for AI self-correction', {
        errorCount: toolErrors.length,
    });

    const messages: ModelMessage[] = [];

    // Build assistant content with attempted tool calls
    const assistantContent: Array<
        { type: 'tool-call'; toolCallId: string; toolName: string; input: Record<string, unknown> }
    > = [];
    for (const error of toolErrors) {
        assistantContent.push({
            type: 'tool-call',
            toolCallId: error.id,
            toolName: error.name,
            input: (error.input || {}) as Record<string, unknown>,
        });
    }

    // Add as assistant message that attempted the tool call
    messages.push({
        role: 'assistant',
        content: assistantContent,
    } as ModelMessage);

    // Add tool result with error feedback
    messages.push({
        role: 'tool',
        content: toolErrors.map((error) => ({
            type: 'tool-result' as const,
            toolCallId: error.id,
            toolName: error.name,
            output: { type: 'error-text' as const, value: error.result },
        })),
    } as ModelMessage);

    return messages;
}
