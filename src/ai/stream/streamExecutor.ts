/**
 * Stream Executor
 * Executes the AI streaming with proper configuration and error handling
 */

import { streamText, smoothStream, stepCountIs } from 'ai';
import { createLogger } from '~logger';
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
    activeTools?: string[];
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
        activeTools,
    } = params;

    try {
        // Get list of available tool names for error feedback
        const availableToolNames = Object.keys(tools);
        log.info('🔧 Available tools for this session:', { 
            count: availableToolNames.length, 
            tools: availableToolNames,
            activeToolsParam: activeTools,
            webSearchAvailable: 'webSearch' in tools,
            retrieveAvailable: 'retrieve' in tools,
        });

        // Create tools with abort signal binding AND error feedback handling
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

                        try {
                            // Call original execute with abort signal
                            const result = await tool.execute(args, abortSignal);
                            return result;
                        } catch (toolError) {
                            // Log tool execution error
                            log.error(`❌ Tool "${name}" execution failed:`, {
                                error: toolError instanceof Error ? toolError.message : String(toolError),
                                args
                            });

                            // Return error as result instead of throwing
                            // This allows the AI to see what went wrong and try again
                            return {
                                error: true,
                                message: toolError instanceof Error ? toolError.message : String(toolError),
                                toolName: name,
                                feedback: `Tool "${name}" failed: ${toolError instanceof Error ? toolError.message : String(toolError)}\n\nPlease try a different approach or check the tool parameters.`
                            };
                        }
                    }
                };
            });
            return boundTools;
        })() : (() => {
            // Also wrap tools without abort signal for consistency
            const boundTools: Record<string, any> = {};
            Object.entries(tools).forEach(([name, tool]) => {
                boundTools[name] = {
                    ...tool,
                    execute: async (args: any) => {
                        try {
                            const result = await tool.execute(args);
                            return result;
                        } catch (toolError) {
                            // Log tool execution error
                            log.error(`❌ Tool "${name}" execution failed:`, {
                                error: toolError instanceof Error ? toolError.message : String(toolError),
                                args
                            });

                            // Return error as result instead of throwing
                            return {
                                error: true,
                                message: toolError instanceof Error ? toolError.message : String(toolError),
                                toolName: name,
                                feedback: `Tool "${name}" failed: ${toolError instanceof Error ? toolError.message : String(toolError)}\n\nPlease try a different approach or check the tool parameters.`
                            };
                        }
                    }
                };
            });
            return boundTools;
        })();

        return await streamText({
            model,
            messages: modelMessages,
            tools: abortableTools,
            system: enhancedPrompt,
            ...(abortSignal && { abortSignal }),
            ...(prepareStep && { prepareStep }),
            ...(activeTools && { activeTools }),

            stopWhen: [stepCountIs(stepCount)],
            toolChoice: 'auto', // Let AI decide when to use tools
            maxRetries: 20, // Internal AI SDK retries for streaming issues
            temperature: 0.7,
            experimental_transform: smoothStream({
                delayInMs: 10,
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

