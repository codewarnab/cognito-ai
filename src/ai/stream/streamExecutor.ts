/**
 * Stream Executor
 * Executes the AI streaming with proper configuration and error handling
 */

import { streamText, smoothStream, stepCountIs } from 'ai';
import { createLogger } from '@logger';
import { APIError, ErrorType } from '../../errors/errorTypes';
import { parseGeminiError } from '../errors/handlers';
import { createOnStepFinishCallback, createOnFinishCallback } from './streamCallbacks';

const log = createLogger('StreamExecutor', 'AI_CHAT');

/**
 * Execute streamText with proper configuration
 */
export async function executeStreamText(params: {
    model: any;
    modelMessages: any[];
    tools: Record<string, any>;
    enhancedPrompt: string;
    abortSignal?: AbortSignal;
    stepCount: number;
    writer: any;
    effectiveMode: 'local' | 'remote';
    modelConfig: any;
    onUsageUpdate?: (usage: any) => void;
    workflowId?: string;
    threadId?: string;
    onError?: (error: Error) => void;
    prepareStep?: (context: any) => Promise<any>;
}) {
    const {
        model,
        modelMessages,
        tools,
        enhancedPrompt,
        abortSignal,
        stepCount,
        writer,
        effectiveMode,
        modelConfig,
        onUsageUpdate,
        workflowId,
        threadId,
        onError,
        prepareStep,
    } = params;

    try {
        // Create tools with abort signal binding
        const abortableTools = abortSignal ? (() => {
            const boundTools: Record<string, any> = {};
            Object.entries(tools).forEach(([name, tool]) => {
                boundTools[name] = {
                    ...tool,
                    execute: async (args: any) => {
                        // Check abort before execution
                        if (abortSignal.aborted) {
                            throw new Error('Operation cancelled');
                        }
                        // Call original execute with abort signal
                        return tool.execute(args, abortSignal);
                    }
                };
            });
            return boundTools;
        })() : tools;

        return await streamText({
            model,
            messages: modelMessages,
            tools: abortableTools,
            system: enhancedPrompt,
            ...(abortSignal && { abortSignal }),
            ...(prepareStep && { prepareStep }),

            stopWhen: [stepCountIs(stepCount)],
            toolChoice: 'auto', // Let AI decide when to use tools
            maxRetries: 20, // Internal AI SDK retries for streaming issues
            temperature: 0.7,
            experimental_transform: smoothStream({
                delayInMs: 20,
                chunking: 'word',
            }),
            // Log when a step completes (includes tool calls)
            onStepFinish: createOnStepFinishCallback(writer),
            // Log when the entire stream finishes
            onFinish: createOnFinishCallback(
                writer,
                effectiveMode,
                modelConfig,
                onUsageUpdate,
                workflowId,
                threadId,
                stepCount
            ),
        });
    } catch (streamError) {
        // Check for local mode quota exceeded error
        const errorMessage = streamError instanceof Error ? streamError.message : String(streamError);
        const errorName = streamError instanceof Error ? streamError.name : '';

        // Handle QuotaExceededError specifically for local mode
        if ((errorName === 'QuotaExceededError' || errorMessage.includes('input is too large')) && effectiveMode === 'local') {
            log.error('Local mode quota exceeded - input too large', {
                messageCount: modelMessages.length,
                errorMessage
            });

            // Create user-friendly error
            const quotaError = new APIError({
                message: 'The input is too large for Gemini Nano',
                statusCode: 413,
                retryable: false,
                userMessage: '⚠️ Input too large for Local Mode. The conversation or page content is too large for Gemini Nano. Please start a new conversation or switch to Remote Mode for larger context.',
                technicalDetails: errorMessage,
                errorCode: ErrorType.API_QUOTA_EXCEEDED,
            });

            // Call onError callback to show toast
            if (onError) {
                onError(quotaError);
            }

            throw quotaError;
        }

        // Parse and enhance the error
        const enhancedError = parseGeminiError(streamError);

        // Log the error
        log.error('streamText error:', {
            errorCode: enhancedError.errorCode,
            retryable: enhancedError.retryable,
            message: enhancedError.message,
        });

        // Throw enhanced error for retry manager to handle
        throw enhancedError;
    }
}
