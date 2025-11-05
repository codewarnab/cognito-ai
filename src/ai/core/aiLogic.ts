/**
 * Frontend AI Logic
 * Direct AI backend integration using AI SDK v5
 * Runs directly in the UI thread, no service worker needed
 */

import { createUIMessageStream, convertToModelMessages, generateId, type UIMessage } from 'ai';
import { createLogger } from '../../logger';
import { localSystemPrompt } from '../prompts/templates/local';
import { remoteSystemPrompt } from '../prompts/templates/remote';
import { getWorkflow } from '../../workflows/registry';

import { hasGeminiApiKey } from '../../utils/geminiApiKey';
import { getModelConfig } from '../../utils/modelSettings';
import {
  APIError,
  NetworkError,
} from '../../errors/errorTypes';
import { type AppUsage, getContextLimits } from '../types/usage';
import { executeStreamText } from '../stream/streamExecutor';
import { parseGeminiError } from '../errors/handlers';
import { writeErrorToStream } from '../stream/streamHelpers';
import { createStreamRetryManager, writeMissingApiKeyError, setupLocalMode, setupRemoteMode } from '../setup';

const log = createLogger('AI-Logic');

/**
 * Stream AI response directly from the frontend
 * Returns a UIMessageStream that can be consumed by useChat
 * 
 * Handles both local (Gemini Nano) and remote (Gemini API) modes
 * Also supports workflow mode with custom prompts and tool filtering
 * 
 * **Error Handling:**
 * - Automatically retries transient errors (rate limits, network issues, server errors)
 * - Displays user-friendly error messages inline in the chat stream
 * - Shows retry countdown when waiting to retry
 * - Validates API key before making requests
 * - Marks API key as invalid after auth failures
 * - Handles malformed function calls from AI model
 * 
 * **Retry Logic:**
 * - Uses exponential backoff with jitter
 * - Respects rate limit headers (Retry-After)
 * - Max 3 retry attempts by default
 * - Provides real-time countdown updates during retry delays
 * 
 * @param params.messages - Chat history to send to the model
 * @param params.abortSignal - Optional signal to abort the request
 * @param params.initialPageContext - Optional page context from conversation start
 * @param params.onError - Optional callback for error events
 * @param params.onUsageUpdate - Optional callback for token usage updates
 * @param params.workflowId - Optional workflow ID for workflow-specific behavior
 * @param params.threadId - Thread ID for workflow session management
 * @returns UIMessageStream that can be consumed by useChat hook
 * @throws {APIError} If API key is invalid or missing
 * @throws {NetworkError} If network is unreachable after retries
 */
export async function streamAIResponse(params: {
  messages: UIMessage[];
  abortSignal?: AbortSignal;
  initialPageContext?: string;
  onError?: (error: Error) => void;
  onUsageUpdate?: (usage: AppUsage) => void;
  workflowId?: string; // Optional workflow ID to use workflow-specific prompt and tools
  threadId?: string; // Thread ID for workflow session management
}) {
  const { messages, abortSignal, initialPageContext, onError, onUsageUpdate, workflowId, threadId } = params;

  log.info('Starting AI stream', { messageCount: messages.length, workflowId: workflowId || 'none' });

  // Get current model configuration
  const modelConfig = await getModelConfig();

  // Determine mode based on API key availability
  let effectiveMode = modelConfig.mode;
  let missingApiKey = false;

  if (effectiveMode === 'remote') {
    const hasKey = await hasGeminiApiKey();
    if (!hasKey) {
      log.warn('⚠️ Remote mode requested but no API key found');
      missingApiKey = true;
      // We'll handle this error in the stream execution
    }
  }

  log.info('🤖 AI Mode:', effectiveMode, effectiveMode === 'remote' ? modelConfig.remoteModel : 'gemini-nano');

  // Initialize variables for streaming
  let model: any;
  let tools: Record<string, any> = {};
  let systemPrompt: string;

  try {
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Create retry manager for this stream session
        const retryManager = createStreamRetryManager(writer, abortSignal);

        try {
          log.info('Stream execute function started');

          // Send initial status (transient - not saved to history)
          writer.write({
            type: 'data-status',
            id: 'status-' + generateId(),
            data: { status: 'processing', timestamp: Date.now() },
            transient: true,
          });

          // Check if we're in workflow mode
          let workflowConfig = null;
          if (workflowId) {
            workflowConfig = getWorkflow(workflowId);
            if (workflowConfig) {
              log.info(' Workflow mode detected:', { workflowId, name: workflowConfig.name });
            } else {
              log.warn(' Invalid workflowId provided:', workflowId);
            }
          }

          // Handle missing API key for remote mode
          if (missingApiKey && effectiveMode === 'remote') {
            writeMissingApiKeyError(writer);
            return; // Exit early
          }

          if (effectiveMode === 'local') {
            // ========== LOCAL MODE (Gemini Nano) ==========
            // setupLocalMode now throws errors instead of returning null
            // This ensures errors are properly caught and handled in the catch block below
            const localSetup = await setupLocalMode(writer, workflowConfig || null, localSystemPrompt, onError);

            model = localSetup.model;
            tools = localSetup.tools;
            systemPrompt = localSetup.systemPrompt;

          } else {
            // ========== REMOTE MODE (Gemini API) ==========
            const modelName = modelConfig.remoteModel || 'gemini-2.5-flash';
            const remoteSetup = await setupRemoteMode(modelName, workflowConfig || null, remoteSystemPrompt, abortSignal);

            model = remoteSetup.model;
            tools = remoteSetup.tools;
            systemPrompt = remoteSetup.systemPrompt;
          }

          // Build enhanced prompt with initial page context if available
          // Skip page context for local mode (Gemini Nano)
          let enhancedPrompt = systemPrompt;
          if (initialPageContext && effectiveMode === 'remote') {
            enhancedPrompt = `${enhancedPrompt}\n\n[INITIAL PAGE CONTEXT - Captured at thread start]\n${initialPageContext}\n\nNote: This is the page context from when this conversation started. If you navigate to different pages or need updated context, use the readPageContent or getActiveTab tools.`;
            log.info(' Enhanced system prompt with initial page context');
          } else if (initialPageContext && effectiveMode === 'local') {
            log.info(' Skipping initial page context for local mode');
          }

          if (workflowConfig) {
            log.info(' Using workflow system prompt:', {
              workflow: workflowConfig.name,
              promptLength: enhancedPrompt.length
            });
          }

          // Convert UI messages to model format
          const modelMessages = convertToModelMessages(messages);

          // Determine step count based on mode and workflow
          const stepCount = workflowConfig?.stepCount || (effectiveMode === 'local' ? 5 : 20);

          // Stream with appropriate configuration
          log.info(' Starting streamText...', {
            mode: effectiveMode,
            toolCount: Object.keys(tools).length,
            hasInitialContext: !!initialPageContext,
            stepCount,
            workflowMode: !!workflowConfig
          });

          // Wrap streamText in retry logic for retryable errors
          const result = await retryManager.execute(async () => {
            return await executeStreamText({
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
            });
          }, 'AI stream');

          // Merge AI stream with status stream
          log.info(' AI streamText result received, merging with UI stream...');

          writer.merge(
            result.toUIMessageStream({
              onError: (error) => {
                log.error('AI stream onError callback', error);

                // Parse error into our error types
                const enhancedError = parseGeminiError(error);

                // Write formatted error to stream
                writeErrorToStream(writer, enhancedError, 'Stream processing');

                // Call user's onError callback
                onError?.(error instanceof Error ? error : new Error(String(error)));

                // Return error message for AI SDK
                return ` Error: ${enhancedError.userMessage}`;
              },
              onFinish: async ({ messages: finalMessages }) => {
                log.info('UI stream completed', {
                  messageCount: finalMessages.length,
                });

                // CRITICAL: Attach usage data to the final assistant message
                // The streamText result has the complete usage data that we need to preserve
                if (finalMessages && finalMessages.length > 0 && effectiveMode === 'remote') {
                  // Get the final usage from the result
                  const finalUsage = await result.usage;

                  if (finalUsage) {
                    // Find the last assistant message and attach usage
                    const lastAssistantMsg = finalMessages
                      .slice()
                      .reverse()
                      .find((msg: any) => msg.role === 'assistant');

                    if (lastAssistantMsg) {
                      // Convert to AppUsage format with context limits
                      const modelName = modelConfig.remoteModel || 'gemini-2.5-flash';
                      const contextLimits = getContextLimits(modelName);

                      const appUsage: AppUsage = {
                        ...finalUsage,
                        context: contextLimits,
                        modelId: modelName
                      };

                      // Attach usage to the message for persistence and recalculation
                      (lastAssistantMsg as any).usage = appUsage;

                      log.info('✅ Attached final usage to message', {
                        messageId: lastAssistantMsg.id,
                        usage: appUsage
                      });
                    }
                  }
                }

                // Send completion status
                writer.write({
                  type: 'data-status',
                  id: 'status-' + generateId(),
                  data: { status: 'completed', timestamp: Date.now() },
                  transient: true,
                });

                // MCP connections are persistent - no cleanup needed
                log.info(' MCP tools remain available for next chat');
              },
            })
          );
        } catch (error) {
          log.error('Stream execution error', error);

          // Parse and format error
          const enhancedError = error instanceof APIError || error instanceof NetworkError
            ? error
            : parseGeminiError(error);

          // Write detailed error to stream
          writeErrorToStream(writer, enhancedError, 'Stream execution');

          // Also send error status
          writer.write({
            type: 'data-status',
            id: 'status-' + generateId(),
            data: {
              status: 'error',
              errorCode: enhancedError instanceof APIError ? enhancedError.errorCode : 'UNKNOWN',
              timestamp: Date.now()
            },
            transient: false,
          });

          // Call user's onError callback
          onError?.(enhancedError);

          // Don't re-throw - error already written to stream
        }
      },
    });

    log.info(' UI message stream created successfully, returning to caller');
    return stream;
  } catch (error) {
    log.error(' Error creating stream', error);

    // Parse error
    const enhancedError = error instanceof APIError || error instanceof NetworkError
      ? error
      : parseGeminiError(error);

    // Call onError callback if provided
    onError?.(enhancedError);

    // Re-throw with enhanced error
    throw enhancedError;
  }
}
