/**
 * Stream Executor
 * Executes the AI streaming with proper configuration and error handling
 */

import { streamText, smoothStream, stepCountIs } from 'ai';
import { createLogger } from '~logger';
import { APIError, ErrorType } from '../../errors/errorTypes';
import { parseGeminiError } from '../errors/handlers';
import { createOnStepFinishCallback, createOnFinishCallback } from './streamCallbacks';
import { TOOLS_REQUIRING_APPROVAL } from '../setup/remoteMode';
import { sanitizeToolName } from '@/utils/mcp/toolNameSanitizer';

const log = createLogger('StreamExecutor', 'AI_CHAT_STREAM');

/**
 * Stream configuration constants
 */
export const STREAM_CONFIG = {
    /** Maximum retries for streaming issues */
    MAX_RETRIES: 20,
    /** AI generation temperature (0-1 range) */
    DEFAULT_TEMPERATURE: 0.7,
    /** Delay in ms for smooth streaming */
    SMOOTH_STREAM_DELAY_MS: 10,
} as const;

/**
 * Sanitize all tool names in a tools record
 * Returns the sanitized tools and a mapping from sanitized names back to original names
 */
function sanitizeToolNames(tools: Record<string, any>): {
    sanitizedTools: Record<string, any>;
    nameMapping: Map<string, string>; // sanitized -> original
} {
    const sanitizedTools: Record<string, any> = {};
    const nameMapping = new Map<string, string>();

    for (const [originalName, tool] of Object.entries(tools)) {
        const sanitizedName = sanitizeToolName(originalName);
        sanitizedTools[sanitizedName] = tool;
        nameMapping.set(sanitizedName, originalName);

        if (originalName !== sanitizedName) {
            log.info(`🔧 Sanitized tool name: ${originalName} -> ${sanitizedName}`);
        }
    }

    return { sanitizedTools, nameMapping };
}

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
}): Promise<ReturnType<typeof streamText>> {
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
        // Sanitize tool names for Gemini compatibility (must start with letter/underscore)
        // This mirrors the backend sanitization - e.g., "21st_magic_component" -> "fn_21st_magic_component"
        const { sanitizedTools, nameMapping } = sanitizeToolNames(tools);

        // Also sanitize activeTools if they exist, so they match the keys in sanitizedTools
        const sanitizedActiveTools = activeTools?.map(name => sanitizeToolName(name));

        // Get list of available tool names for error feedback (show original names for debugging)
        const availableToolNames = Object.keys(tools);
        const sanitizedToolNames = Object.keys(sanitizedTools);
        log.info('🔧 Available tools for this session:', {
            count: availableToolNames.length,
            originalTools: availableToolNames,
            sanitizedTools: sanitizedToolNames,
            sanitizedCount: nameMapping.size,
            activeToolsParam: activeTools,
            webSearchAvailable: 'webSearch' in sanitizedTools,
            retrieveAvailable: 'retrieve' in sanitizedTools,
            deepWebSearchAvailable: 'deepWebSearch' in sanitizedTools,
        });

        /**
         * Process tool result to optimize payload sent to AI
         * Removes UI-only fields that shouldn't be sent to the model
         */
        const processToolResultForAI = (toolName: string, result: any): any => {
            if (!result || typeof result !== 'object') {
                return result;
            }

            // For screenshot tool: remove screenshotDisplay (full quality PNG for UI only)
            // The 'screenshot' field already contains the compressed version for AI
            if (toolName === 'takeScreenshot' && result.screenshotDisplay) {
                const { screenshotDisplay, ...resultForAI } = result;
                log.info('📸 Screenshot optimized for AI - removed UI-only display image', {
                    compressedSizeKB: result.compressionInfo?.compressedSizeKB,
                    removedSizeKB: result.compressionInfo?.originalSizeKB,
                });
                return resultForAI;
            }

            return result;
        };

        // Create tools with abort signal binding AND error feedback handling
        // Use sanitizedTools to ensure Gemini-compatible names
        const abortableTools = abortSignal ? (() => {
            const boundTools: Record<string, any> = {};
            Object.entries(sanitizedTools).forEach(([name, tool]) => {
                // Human-in-the-loop: Strip execute from tools requiring approval
                // AI SDK will wait for frontend to call addToolOutput
                if (TOOLS_REQUIRING_APPROVAL.includes(name)) {
                    log.info(`🛡️ Tool "${name}" requires human approval - no auto-execute`);
                    const { execute, ...toolWithoutExecute } = tool as any;
                    boundTools[name] = toolWithoutExecute;
                    return;
                }

                // Tools without execute (WebMCP, MCP tools) use HITL pattern
                // Pass them through unchanged - AI SDK will wait for addToolOutput
                if (typeof (tool as any).execute !== 'function') {
                    log.info(`🛡️ Tool "${name}" has no execute function (HITL pattern)`);
                    boundTools[name] = tool;
                    return;
                }

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
                            // Process result to remove UI-only fields before sending to AI
                            return processToolResultForAI(name, result);
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
            Object.entries(sanitizedTools).forEach(([name, tool]) => {
                // Human-in-the-loop: Strip execute from tools requiring approval
                // AI SDK will wait for frontend to call addToolOutput
                if (TOOLS_REQUIRING_APPROVAL.includes(name)) {
                    log.info(`🛡️ Tool "${name}" requires human approval - no auto-execute`);
                    const { execute, ...toolWithoutExecute } = tool as any;
                    boundTools[name] = toolWithoutExecute;
                    return;
                }

                // Tools without execute (WebMCP, MCP tools) use HITL pattern
                // Pass them through unchanged - AI SDK will wait for addToolOutput
                if (typeof (tool as any).execute !== 'function') {
                    log.info(`🛡️ Tool "${name}" has no execute function (HITL pattern)`);
                    boundTools[name] = tool;
                    return;
                }

                boundTools[name] = {
                    ...tool,
                    execute: async (args: any) => {
                        try {
                            const result = await tool.execute(args);
                            // Process result to remove UI-only fields before sending to AI
                            return processToolResultForAI(name, result);
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


        if (sanitizedActiveTools) {
            log.info('🔧 Active tools sanitized:', { original: activeTools, sanitized: sanitizedActiveTools });
        }

        return await streamText({
            model,
            messages: modelMessages,
            tools: abortableTools,
            system: enhancedPrompt,
            ...(abortSignal && { abortSignal }),
            ...(prepareStep && { prepareStep }),
            ...(sanitizedActiveTools && { activeTools: sanitizedActiveTools }),

            stopWhen: [stepCountIs(stepCount)],
            toolChoice: 'auto', // Let AI decide when to use tools
            maxRetries: STREAM_CONFIG.MAX_RETRIES,
            temperature: STREAM_CONFIG.DEFAULT_TEMPERATURE,
            experimental_transform: smoothStream({
                delayInMs: STREAM_CONFIG.SMOOTH_STREAM_DELAY_MS,
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

