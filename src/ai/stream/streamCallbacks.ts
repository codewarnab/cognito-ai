/**
 * Stream Callbacks
 * Handles onStepFinish and onFinish callbacks for AI streaming
 */

import { generateId } from 'ai';
import { createLogger } from '~logger';
import { APIError } from '../../errors/errorTypes';
import { extractMalformedCallInfo } from '../errors/handlers';
import { type AppUsage, getContextLimits } from '../types/usage';
import { workflowSessionManager } from '../../workflows/sessionManager';
import { markGoogleApiKeyValid } from '@/utils/credentials';

// Helper function for compatibility
const markApiKeyValid = markGoogleApiKeyValid;

const log = createLogger('StreamCallbacks', 'AI_CHAT');

/**
 * Tracks empty response occurrences for feedback loop
 */
interface EmptyResponseTracker {
    consecutiveEmptyCount: number;
    lastEmptyTimestamp: number;
}

const emptyResponseTrackers = new Map<string, EmptyResponseTracker>();

/**
 * Create onStepFinish callback for streamText
 * Includes feedback loop for empty responses (model returns STOP with no content)
 */
export function createOnStepFinishCallback(writer: any, sessionId?: string) {
    const trackerId = sessionId || 'default-' + Date.now();
    
    // Initialize tracker for this session
    if (!emptyResponseTrackers.has(trackerId)) {
        emptyResponseTrackers.set(trackerId, {
            consecutiveEmptyCount: 0,
            lastEmptyTimestamp: 0
        });
    }

    return ({ text, toolCalls, toolResults, finishReason, usage, warnings, response }: any) => {
        const tracker = emptyResponseTrackers.get(trackerId)!;
        
        // Detect empty response: STOP finish reason with no text and no tool calls
        const hasText = text && text.trim().length > 0;
        const hasToolCalls = toolCalls && toolCalls.length > 0;
        const isEmptyResponse = finishReason === 'stop' && !hasText && !hasToolCalls;

        if (isEmptyResponse) {
            tracker.consecutiveEmptyCount++;
            tracker.lastEmptyTimestamp = Date.now();

            log.warn('⚠️ Empty response detected - model returned STOP with no content', {
                consecutiveCount: tracker.consecutiveEmptyCount,
                finishReason,
                hasText,
                hasToolCalls,
                usage: usage ? {
                    promptTokens: usage.promptTokens,
                    totalTokens: usage.totalTokens,
                    cachedTokens: usage.cachedInputTokens
                } : 'none'
            });

            // Write feedback to stream based on consecutive empty count
            if (tracker.consecutiveEmptyCount === 1) {
                // First empty response - gentle nudge
                writer.write({
                    type: 'text-delta',
                    id: 'empty-response-feedback-' + generateId(),
                    delta: '\n\n*Processing your request...*\n\n',
                });
            } else if (tracker.consecutiveEmptyCount === 2) {
                // Second empty response - more explicit feedback
                writer.write({
                    type: 'text-delta',
                    id: 'empty-response-feedback-' + generateId(),
                    delta: '\n\n *The model returned an empty response. Attempting to continue...*\n\n',
                });
            } else if (tracker.consecutiveEmptyCount >= 3) {
                // Multiple empty responses - notify user
                log.error('🔴 Multiple consecutive empty responses detected', {
                    count: tracker.consecutiveEmptyCount
                });

                writer.write({
                    type: 'text-delta',
                    id: 'empty-response-error-' + generateId(),
                    delta: '\n\n **The model is having trouble generating a response.** This can happen when:\n' +
                        '- The context is too complex\n' +
                        '- The request needs clarification\n' +
                        '- There\'s a temporary service issue\n\n' +
                        'Please try rephrasing your request or starting a new conversation.\n\n',
                });

                // Send status for UI to potentially show r button
                writer.write({
                    type: 'data-status',
                    id: 'empty-response-status-' + generateId(),
                    data: {
                        status: 'empty-response',
                        consecutiveCount: tracker.consecutiveEmptyCount,
                        timestamp: Date.now()
                    },
                    transient: false,
                });
            }
        } else {
            // Reset tracker on successful response
            if (hasText || hasToolCalls) {
                tracker.consecutiveEmptyCount = 0;
            }
        }

        // Check for malformed function calls or errors
        if (finishReason === 'error' || finishReason === 'other' || finishReason === 'unknown') {
            log.error('⚠️ Step finished with error', {
                finishReason,
                text: text?.substring(0, 200),
                warnings: warnings,
                responseInfo: response ? 'Response available' : 'No response',
            });

            // Create malformed function call error
            const malformedError = APIError.malformedFunctionCall(
                `Finish reason: ${finishReason}`,
                undefined
            );

            // Write inline error notification to stream
            writer.write({
                type: 'text-delta',
                id: 'step-error-' + generateId(),
                delta: `\n\n⚠️ ${malformedError.userMessage}\n\n`,
            });
        }

        // Check for MALFORMED_FUNCTION_CALL via response
        const malformedInfo = extractMalformedCallInfo(response);
        if (malformedInfo.isMalformed) {
            log.error('🔴 GEMINI MALFORMED_FUNCTION_CALL ERROR', {
                finishReason: 'MALFORMED_FUNCTION_CALL',
                generatedCode: malformedInfo.code?.substring(0, 500),
                fullText: text?.substring(0, 200),
            });

            // Create and write detailed error
            const malformedError = APIError.malformedFunctionCall(
                `The model generated: ${malformedInfo.code?.substring(0, 200)}`,
                undefined
            );

            // Write error to stream
            const errorMarkdown = `\n\n⚠️ **${malformedError.userMessage}**\n\n${malformedError.technicalDetails}\n\n`;
            writer.write({
                type: 'text-delta',
                id: 'malformed-error-' + generateId(),
                delta: errorMarkdown,
            });
        }

        if (toolCalls && toolCalls.length > 0) {
            log.info('🔧 Tools called:', {
                count: toolCalls.length,
                calls: toolCalls.map((call: any) => ({
                    id: call.toolCallId,
                    name: call.toolName,
                    isAgentTool: call.toolName === 'getYouTubeTranscript',
                })),
            });
        }

        if (toolResults && toolResults.length > 0) {
            log.info('✅ Tool results:', {
                count: toolResults.length,
                results: toolResults.map((result: any) => ({
                    id: result.toolCallId,
                    name: result.toolName,
                    status: 'output' in result ? 'success' : 'error',
                })),
            });
        }

        log.info('📊 Step finished:', {
            finishReason,
            textLength: text?.length || 0,
            tokensUsed: usage?.totalTokens || 0,
        });
    };
}

/**
 * Create onFinish callback for streamText
 */
export function createOnFinishCallback(
    writer: any,
    effectiveMode: 'local' | 'remote',
    modelConfig: any,
    onUsageUpdate?: (usage: AppUsage) => void,
    workflowId?: string,
    threadId?: string,
    stepCount?: number,
    sessionId?: string
) {
    return async ({ text, finishReason, usage, steps }: any) => {
        log.info('🏁 Stream finished:', {
            finishReason,
            textLength: text?.length || 0,
            tokensUsed: usage?.totalTokens || 0,
            stepCount: steps?.length || 0,
            workflowMode: !!workflowId,
            threadId: threadId || 'unknown'
        });

        // Clean up empty response tracker for this session
        const trackerId = sessionId || 'default-' + Date.now();
        emptyResponseTrackers.delete(trackerId);

        // Capture and enhance usage information for remote mode only
        if (effectiveMode === 'remote' && usage) {
            const modelName = modelConfig.remoteModel || 'gemini-2.5-flash';
            const contextLimits = getContextLimits(modelName);

            const appUsage: AppUsage = {
                ...usage,
                context: contextLimits,
                modelId: modelName
            };

            log.info('✅ Token usage tracked', {
                input: appUsage.inputTokens,
                output: appUsage.outputTokens,
                total: appUsage.totalTokens,
                cached: appUsage.cachedInputTokens,
                reasoning: appUsage.reasoningTokens,
                percentUsed: appUsage.totalTokens && appUsage.context?.totalMax
                    ? Math.round((appUsage.totalTokens / appUsage.context.totalMax) * 100)
                    : 0,
                modelId: appUsage.modelId
            });

            // Call usage callback to update UI
            onUsageUpdate?.(appUsage);
        }

        // Check if we hit the step count limit
        const hitStepLimit = steps && stepCount && steps.length >= stepCount;
        const lastStepHasToolCalls = steps && steps.length > 0 &&
            steps[steps.length - 1].toolCalls &&
            steps[steps.length - 1].toolCalls.length > 0;

        // If we hit the step limit, show continue button
        if (hitStepLimit && finishReason) {
            log.info('⏸️ Step count limit reached - continue button should be shown', {
                stepCount: steps.length,
                maxStepCount: stepCount,
                lastStepHasToolCalls,
                finishReason
            });

            // Write a data part indicating continue is available
            writer.write({
                type: 'data-status',
                id: 'continue-available-' + generateId(),
                data: {
                    status: 'continue-available',
                    stepCount: steps.length,
                    maxStepCount: stepCount,
                    timestamp: Date.now()
                },
                transient: false, // Keep this in history so it persists
            });
        }

        // Mark API key as valid after successful completion (remote mode only)
        if (effectiveMode === 'remote') {
            markApiKeyValid().catch(err =>
                log.error('Failed to mark API key as valid:', err)
            );
        }

        // Check for workflow completion marker
        if (workflowId && threadId && text) {
            if (text.includes('[WORKFLOW_COMPLETE]')) {
                log.info('✅ WORKFLOW COMPLETION DETECTED - Ending workflow session', {
                    threadId,
                    workflowId
                });
                workflowSessionManager.endSession(threadId);
            } else {
                log.info('🔄 Workflow still active - no completion marker found', {
                    threadId,
                    workflowId
                });
            }
        }
    };
}

