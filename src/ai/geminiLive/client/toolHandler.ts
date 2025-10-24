/**
 * Tool Handler for Gemini Live Client
 * Manages tool declarations and execution
 */

import type { FunctionCall } from '../types';
import { getTool } from '../../toolRegistryUtils';
import {
    browserActionAgentDeclaration,
    executeBrowserActionAgent,
} from '../../agents/browserActionAgent';
import { createLogger } from '../../../logger';
import { ToolExecutionHandler } from '../errorHandler';
import { DEFAULT_CONFIG } from './config';
import {
    parseError,
    isRetryableError,
    RetryManager,
    RetryPresets,
    formatErrorInline,
} from '../../../errors';

const log = createLogger('ToolHandler');

export class GeminiLiveToolHandler {
    private agentToolExecutors: Map<string, (args: any) => Promise<any>> = new Map();
    private retryManager: RetryManager;

    constructor() {
        // Use Quick preset for tool execution (shorter delays, suitable for user-facing operations)
        this.retryManager = new RetryManager(RetryPresets.Quick);
    }

    /**
     * Get tool declarations for Live API
     * Only exposes agent tool instead of individual browser tools
     */
    async getToolDeclarations(): Promise<any[]> {
        try {
            log.info('🤖 Preparing agent tool for Gemini Live (voice-optimized)');

            // Create executor wrapper and store it
            const browserActionExecutor = async (args: any) => {
                return await executeBrowserActionAgent(args);
            };

            // Store executor in the map
            this.agentToolExecutors.set('executeBrowserAction', browserActionExecutor);

            log.info('Agent tool prepared', {
                name: browserActionAgentDeclaration.name,
                description: browserActionAgentDeclaration.description?.substring(0, 100) + '...'
            });

            return [browserActionAgentDeclaration];

        } catch (error) {
            log.error('Failed to get tool declarations', error);
            return [];
        }
    }

    /**
     * Execute tool calls from the AI with timeout and validation
     */
    async executeToolCalls(
        functionCalls: FunctionCall[],
        onToolCall?: (toolName: string, args: any) => void,
        onToolResult?: (toolName: string, result: any) => void,
        timeoutMs: number = 30000 // 30 second default timeout
    ): Promise<any[]> {
        log.info('🔧 Received tool calls from Gemini Live', {
            count: functionCalls.length,
            tools: functionCalls.map(fc => ({ name: fc.name, args: fc.args }))
        });

        const responses: any[] = [];

        for (const call of functionCalls) {
            log.info('🎯 Executing tool', {
                name: call.name,
                args: call.args,
                callId: call.id
            });

            // Notify callback
            if (onToolCall) {
                onToolCall(call.name, call.args);
            }

            try {
                // Validate function call arguments
                this.validateToolCall(call);

                // First check if this is an agent tool
                const agentExecutor = this.agentToolExecutors.get(call.name);

                let result: any;

                if (agentExecutor) {
                    // Execute agent tool with timeout
                    log.info('🤖 Executing agent tool (Browser Action Agent)', {
                        name: call.name,
                        taskDescription: call.args?.taskDescription
                    });

                    const startTime = Date.now();
                    result = await this.executeWithTimeout(
                        () => agentExecutor(call.args),
                        timeoutMs,
                        call.name
                    );
                    const duration = Date.now() - startTime;

                    log.info('✅ Agent tool completed', {
                        name: call.name,
                        duration: `${duration}ms`,
                        resultType: typeof result,
                        hasResult: !!result,
                        resultKeys: typeof result === 'object' && result ? Object.keys(result) : [],
                        resultPreview: JSON.stringify(result).substring(0, 300) + '...'
                    });
                } else {
                    // Fallback: Get tool from registry
                    const toolDef = getTool(call.name);

                    if (!toolDef) {
                        throw new Error(`Tool not found: ${call.name}`);
                    }

                    log.info('🔨 Executing regular tool from registry', { name: call.name });
                    const startTime = Date.now();
                    result = await this.executeWithTimeout(
                        () => toolDef.execute(call.args),
                        timeoutMs,
                        call.name
                    );
                    const duration = Date.now() - startTime;

                    log.info('✅ Regular tool completed', {
                        name: call.name,
                        duration: `${duration}ms`,
                        resultPreview: JSON.stringify(result).substring(0, 200) + '...'
                    });
                }

                log.info('📊 Tool execution completed - Full result', {
                    name: call.name,
                    result,
                    resultJSON: JSON.stringify(result, null, 2)
                });

                // Notify callback
                if (onToolResult) {
                    onToolResult(call.name, result);
                }

                // Truncate large responses
                const truncatedResult = this.truncateToolResponse(result, call.name);

                log.info('📦 Preparing response for Gemini Live', {
                    name: call.name,
                    callId: call.id,
                    originalResultLength: JSON.stringify(result).length,
                    truncatedResultLength: JSON.stringify(truncatedResult).length,
                    wasTruncated: JSON.stringify(result).length !== JSON.stringify(truncatedResult).length,
                    truncatedResult: truncatedResult
                });

                // Format response
                responses.push({
                    id: call.id,
                    name: call.name,
                    response: {
                        result: truncatedResult
                    }
                });

            } catch (error) {
                log.error('❌ Tool execution failed', {
                    name: call.name,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                });

                // Parse and categorize the error
                const typedError = parseError(error, {
                    context: 'tool-execution',
                    toolName: call.name,
                });

                // Use enhanced error handler to format response
                const { errorResponse, shouldRetry, formattedError } = ToolExecutionHandler.handleToolError(
                    call.name,
                    typedError instanceof Error ? typedError : new Error(String(error)),
                    call.args
                );

                // Log whether error is retryable
                if (shouldRetry && isRetryableError(typedError)) {
                    log.info('Error is retryable, but tool execution does not auto-retry in Live API', {
                        name: call.name,
                        errorCode: (typedError as any).errorCode,
                    });
                }

                // Send error response with enhanced formatting
                responses.push({
                    id: call.id,
                    name: call.name,
                    response: {
                        ...errorResponse,
                        // Include formatted error for AI to understand
                        formattedError,
                    }
                });
            }
        }

        return responses;
    }

    /**
     * Truncate tool response to prevent WebSocket message size errors
     */
    private truncateToolResponse(result: any, toolName: string): any {
        const MAX_CONTENT_LENGTH = DEFAULT_CONFIG.maxContentLength;

        if (!result || typeof result !== 'object') {
            return result;
        }

        const truncated = { ...result };
        let wasTruncated = false;

        // Handle readPageContent specifically
        if (toolName === 'readPageContent' && truncated.content && typeof truncated.content === 'string') {
            const originalLength = truncated.content.length;
            if (originalLength > MAX_CONTENT_LENGTH) {
                truncated.content = truncated.content.substring(0, MAX_CONTENT_LENGTH);
                truncated.contentLength = truncated.content.length;
                truncated.truncated = true;
                truncated.originalLength = originalLength;
                wasTruncated = true;
                log.warn(`Truncated ${toolName} content from ${originalLength} to ${MAX_CONTENT_LENGTH} chars`);
            }
        }

        // Generic handling for any large string fields
        for (const [key, value] of Object.entries(truncated)) {
            if (typeof value === 'string' && value.length > MAX_CONTENT_LENGTH) {
                truncated[key] = value.substring(0, MAX_CONTENT_LENGTH);
                if (!truncated.truncated) {
                    truncated.truncated = true;
                    truncated.truncatedFields = [key];
                } else if (Array.isArray(truncated.truncatedFields)) {
                    truncated.truncatedFields.push(key);
                } else {
                    truncated.truncatedFields = [key];
                }
                wasTruncated = true;
                log.warn(`Truncated ${toolName}.${key} from ${value.length} to ${MAX_CONTENT_LENGTH} chars`);
            }
        }

        if (wasTruncated) {
            log.info(`Tool response truncated for Live API compatibility`, {
                toolName,
                fields: truncated.truncatedFields
            });
        }

        return truncated;
    }

    /**
     * Validate tool call arguments
     */
    private validateToolCall(call: FunctionCall): void {
        if (!call.name) {
            throw parseError(new Error('Tool name is required'), {
                context: 'tool-execution',
                toolName: 'unknown',
            });
        }

        // Basic validation - ensure args is an object if provided
        if (call.args !== undefined && call.args !== null && typeof call.args !== 'object') {
            throw parseError(new Error('Tool arguments must be an object'), {
                context: 'tool-execution',
                toolName: call.name,
            });
        }
    }

    /**
     * Execute a function with timeout
     */
    private async executeWithTimeout<T>(
        fn: () => Promise<T>,
        timeoutMs: number,
        toolName: string
    ): Promise<T> {
        return Promise.race([
            fn(),
            new Promise<T>((_, reject) => {
                setTimeout(() => {
                    const timeoutError = parseError(
                        new Error(`Tool execution timed out after ${timeoutMs}ms`),
                        { context: 'tool-execution', toolName }
                    );
                    reject(timeoutError);
                }, timeoutMs);
            })
        ]);
    }

    /**
     * Clear all tool executors
     */
    clear(): void {
        this.agentToolExecutors.clear();
    }
}
