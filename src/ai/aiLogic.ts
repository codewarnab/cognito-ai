/**
 * Frontend AI Logic
 * Direct AI backend integration using AI SDK v5
 * Runs directly in the UI thread, no service worker needed
 */

import { streamText, createUIMessageStream, convertToModelMessages, generateId, type UIMessage, stepCountIs, smoothStream } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { builtInAI } from '@built-in-ai/core';
import { createLogger } from '../logger';
import { localSystemPrompt } from './prompt/local';
import { remoteSystemPrompt } from './prompt/remote';
import { getToolsForMode } from './toolRegistry';
import { getAllTools } from './toolRegistryUtils';
import { getMCPToolsFromBackground } from './mcpProxy';
import { youtubeAgentAsTool } from './agents/youtubeAgent';
import { getWorkflow } from '../workflows/registry';
import { workflowSessionManager } from '../workflows/sessionManager';
import { getGeminiApiKey, hasGeminiApiKey, validateAndGetApiKey, markApiKeyValid, markApiKeyInvalid } from '../utils/geminiApiKey';
import { getModelConfig } from '../utils/modelSettings';
import {
  downloadLanguageModel,
  downloadSummarizer,
  type DownloadProgressEvent,
} from './modelDownloader';
import {
  APIError,
  NetworkError,
  isRetryableError,
  ErrorType
} from '../errors/errorTypes';
import {
  formatErrorInline,
  formatRetryCountdown,
  formatRetryAttempt
} from '../errors/errorMessages';
import { createRetryManager, RetryPresets } from '../errors/retryManager';
import { type AppUsage, getContextLimits } from './types/usage';

const log = createLogger('AI-Logic');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract malformed function call details from Gemini response
 * Gemini sometimes returns Python code instead of proper function calls
 */
function extractMalformedCallInfo(response: any): { isMalformed: boolean; code?: string; message?: string } {
  try {
    // Check multiple possible response structures
    const bodyData = response?.body || response;
    const candidates = bodyData?.candidates;

    if (candidates?.[0]?.finishReason === 'MALFORMED_FUNCTION_CALL') {
      const finishMessage = candidates[0].finishMessage || '';
      return {
        isMalformed: true,
        code: finishMessage,
        message: 'Model generated code instead of a function call'
      };
    }

    return { isMalformed: false };
  } catch (error) {
    log.warn('Error extracting malformed call info:', error);
    return { isMalformed: false };
  }
}

/**
 * Parse error from Gemini API response
 * Handles various error formats and status codes
 * Also updates API key validation cache based on auth errors
 */
async function parseGeminiErrorAsync(error: any): Promise<APIError> {
  try {
    // Extract status code
    const statusCode = error?.statusCode || error?.status || error?.response?.status;

    // Extract error message
    const message = error?.message || error?.error?.message || String(error);
    const details = error?.error?.details || error?.details || message;

    // Handle specific status codes
    if (statusCode === 429) {
      // Rate limit - check for Retry-After header
      const retryAfter = error?.headers?.['retry-after'] ||
        error?.response?.headers?.['retry-after'];
      const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
      return APIError.rateLimitExceeded(retryAfterMs, details);
    }

    if (statusCode === 403) {
      // Check if it's quota exceeded or permission issue
      if (message.toLowerCase().includes('quota')) {
        return APIError.quotaExceeded(details);
      }
      return new APIError({
        message: 'Forbidden',
        statusCode: 403,
        retryable: false,
        userMessage: 'Access forbidden. Please check your API permissions.',
        technicalDetails: details,
        errorCode: ErrorType.API_INVALID_REQUEST,
      });
    }

    if (statusCode === 401) {
      // Mark API key as invalid in cache
      await markApiKeyInvalid('AUTH_FAILED_401');
      return APIError.authFailed(details);
    }

    if (statusCode >= 500 && statusCode < 600) {
      return APIError.serverError(statusCode, details);
    }

    // Check for network errors
    if (error?.code === 'ETIMEDOUT' || message.includes('timeout')) {
      return new NetworkError({
        message: 'Request timeout',
        retryable: true,
        userMessage: 'Request timed out. Retrying...',
        technicalDetails: details,
        errorCode: ErrorType.NETWORK_TIMEOUT,
      });
    }

    if (error?.code === 'ECONNRESET' || message.includes('connection reset')) {
      return NetworkError.connectionReset(details);
    }

    // Default to generic API error
    return new APIError({
      message,
      statusCode,
      retryable: statusCode ? statusCode >= 500 : false,
      userMessage: 'An error occurred while processing your request.',
      technicalDetails: details,
      errorCode: ErrorType.UNKNOWN_ERROR,
    });
  } catch (parseError) {
    log.error('Error parsing Gemini error:', parseError);
    return new APIError({
      message: String(error),
      retryable: false,
      userMessage: 'An unexpected error occurred.',
      technicalDetails: String(error),
      errorCode: ErrorType.UNKNOWN_ERROR,
    });
  }
}

/**
 * Synchronous version for backward compatibility
 */
function parseGeminiError(error: any): APIError {
  // For synchronous contexts, we can't await the async operations
  // So we'll use a simplified version without API key cache updates
  try {
    const statusCode = error?.statusCode || error?.status || error?.response?.status;
    const message = error?.message || error?.error?.message || String(error);
    const details = error?.error?.details || error?.details || message;

    if (statusCode === 429) {
      const retryAfter = error?.headers?.['retry-after'] ||
        error?.response?.headers?.['retry-after'];
      const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
      return APIError.rateLimitExceeded(retryAfterMs, details);
    }

    if (statusCode === 403) {
      if (message.toLowerCase().includes('quota')) {
        return APIError.quotaExceeded(details);
      }
      return new APIError({
        message: 'Forbidden',
        statusCode: 403,
        retryable: false,
        userMessage: 'Access forbidden. Please check your API permissions.',
        technicalDetails: details,
        errorCode: ErrorType.API_INVALID_REQUEST,
      });
    }

    if (statusCode === 401) {
      // Note: Cache update should be done in async context
      markApiKeyInvalid('AUTH_FAILED_401').catch(err =>
        log.error('Failed to mark API key invalid:', err)
      );
      return APIError.authFailed(details);
    }

    if (statusCode >= 500 && statusCode < 600) {
      return APIError.serverError(statusCode, details);
    }

    if (error?.code === 'ETIMEDOUT' || message.includes('timeout')) {
      return new NetworkError({
        message: 'Request timeout',
        retryable: true,
        userMessage: 'Request timed out. Retrying...',
        technicalDetails: details,
        errorCode: ErrorType.NETWORK_TIMEOUT,
      });
    }

    if (error?.code === 'ECONNRESET' || message.includes('connection reset')) {
      return NetworkError.connectionReset(details);
    }

    return new APIError({
      message,
      statusCode,
      retryable: statusCode ? statusCode >= 500 : false,
      userMessage: 'An error occurred while processing your request.',
      technicalDetails: details,
      errorCode: ErrorType.UNKNOWN_ERROR,
    });
  } catch (parseError) {
    log.error('Error parsing Gemini error:', parseError);
    return new APIError({
      message: String(error),
      retryable: false,
      userMessage: 'An unexpected error occurred.',
      technicalDetails: String(error),
      errorCode: ErrorType.UNKNOWN_ERROR,
    });
  }
}

/**
 * Write error message to stream with formatting
 */
function writeErrorToStream(
  writer: any,
  error: Error,
  context?: string
): void {
  // Parse error into our error types
  const appError = error instanceof APIError || error instanceof NetworkError
    ? error
    : parseGeminiError(error);

  // Format error message for inline display
  const errorMarkdown = formatErrorInline(appError);

  // Write error to stream
  writer.write({
    type: 'text-delta',
    id: 'error-' + generateId(),
    delta: `\n\n${errorMarkdown}\n`,
  });

  log.error(`AI Stream Error [${context || 'unknown'}]:`, {
    errorCode: appError instanceof APIError ? appError.errorCode : 'UNKNOWN',
    message: appError.message,
    retryable: isRetryableError(appError),
  });
}

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
        const retryManager = createRetryManager({
          ...RetryPresets.Standard,
          abortSignal,
          onRetry: (attempt, delay, error) => {
            log.info('Retrying AI request', { attempt, delay, error: error.message });

            // Write retry status to stream
            const seconds = Math.ceil(delay / 1000);
            const retryMessage = formatRetryCountdown(seconds, attempt, 3);
            writer.write({
              type: 'data-status',
              id: 'retry-status-' + generateId(),
              data: {
                status: 'retrying',
                message: retryMessage,
                attempt,
                maxAttempts: 3,
                delay,
                timestamp: Date.now()
              },
              transient: true,
            });
          },
          onCountdown: (remainingMs, attempt) => {
            // Update countdown in real-time
            const seconds = Math.ceil(remainingMs / 1000);
            if (seconds > 0) {
              writer.write({
                type: 'data-status',
                id: 'countdown-' + generateId(),
                data: {
                  status: 'countdown',
                  remainingSeconds: seconds,
                  attempt,
                  timestamp: Date.now()
                },
                transient: true,
              });
            }
          },
        });

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
            const errorMsg = 'Please configure your Gemini API key to use the AI assistant.';
            const instructionMsg = '\n\n**How to add your API key:**\n1. Click the **⋯** (three dots) menu in the chat header\n2. Select "Gemini API Key Setup"\n3. Enter your Gemini API key\n4. Click "Save API Key"\n\n**Don\'t have an API key?**\nGet a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)';

            log.error('❌ Missing API key for remote mode');

            // Write error message to the stream
            writer.write({
              type: 'text-delta',
              id: 'api-key-error-' + generateId(),
              delta: `⚠️ **API Key Required**\n\n${errorMsg}${instructionMsg}`,
            });

            // Write completion status
            writer.write({
              type: 'data-status',
              id: 'status-' + generateId(),
              data: { status: 'completed', timestamp: Date.now() },
              transient: true,
            });

            return; // Exit early
          }

          if (effectiveMode === 'local') {
            // ========== LOCAL MODE (Gemini Nano) ==========
            log.info('🔧 Using LOCAL Gemini Nano');

            // Download Language Model with progress tracking
            let languageModelSession: any
            try {
              languageModelSession = await downloadLanguageModel((progress: DownloadProgressEvent) => {
                const percentage = Math.round(progress.loaded * 100);
                log.info(`📥 Language Model download: ${percentage}%`);

                // Send download progress status to UI (shown as toast)
                writer.write({
                  type: 'data-status',
                  id: 'language-model-download-' + generateId(),
                  data: {
                    status: 'downloading',
                    model: 'language',
                    progress: percentage,
                    message: `Downloading Language Model... ${percentage}%`,
                    timestamp: Date.now(),
                  },
                  transient: true,
                });
              });

              log.info('✅ Language Model ready');
            } catch (error) {
              log.error('❌ Failed to download Language Model:', error);
              throw new Error(`Language Model unavailable: ${error instanceof Error ? error.message : String(error)}`);
            }

            // Download Summarizer Model with progress tracking
            try {
              await downloadSummarizer((progress: DownloadProgressEvent) => {
                const percentage = Math.round(progress.loaded * 100);
                log.info(`📥 Summarizer download: ${percentage}%`);

                // Send download progress status to UI (shown as toast)
                writer.write({
                  type: 'data-status',
                  id: 'summarizer-download-' + generateId(),
                  data: {
                    status: 'downloading',
                    model: 'summarizer',
                    progress: percentage,
                    message: `Downloading Summarizer... ${percentage}%`,
                    timestamp: Date.now(),
                  },
                  transient: true,
                });
              });

              log.info('✅ Summarizer ready');
            } catch (error) {
              // Summarizer is optional, just log warning
              log.warn('⚠️ Summarizer unavailable:', error);
            }

            // Get local model using the downloaded language model session
            model = builtInAI();

            // Get limited tool set (basic tools only) from tool registry
            const localTools = getToolsForMode('local');

            // In workflow mode, filter to only allowed tools
            if (workflowConfig) {
              tools = Object.fromEntries(
                Object.entries(localTools).filter(([name]) =>
                  workflowConfig.allowedTools.includes(name)
                )
              );
              log.info('🔧 Filtered local tools for workflow:', {
                workflow: workflowConfig.name,
                allowed: workflowConfig.allowedTools,
                filtered: Object.keys(tools)
              });
            } else {
              tools = localTools;
            }

            log.info('🔧 Local tools available:', {
              count: Object.keys(tools).length,
              names: Object.keys(tools)
            });

            // Use local or workflow-specific prompt
            systemPrompt = workflowConfig ? workflowConfig.systemPrompt : localSystemPrompt;

          } else {
            // ========== REMOTE MODE (Gemini API) ==========
            const modelName = modelConfig.remoteModel || 'gemini-2.5-flash';
            log.info(' Using REMOTE model:', modelName);

            // Validate and get API key (throws APIError if invalid)
            const apiKey = await validateAndGetApiKey();

            // Custom fetch to remove referrer header (fixes 403 errors in Chrome extensions)
            const customFetch = async (url: RequestInfo | URL, init?: RequestInit) => {
              const newInit = { ...init };
              if (newInit.headers) {
                delete (newInit.headers as any).Referer;
              }
              return fetch(url, newInit);
            };

            // Initialize model
            const google = createGoogleGenerativeAI({ apiKey, fetch: customFetch });
            model = google(modelName);

            // Define workflow-only tools (only available in workflow mode)
            const workflowOnlyTools = ['generateMarkdown', 'generatePDF', 'getReportTemplate'];

            // Get all registered tools (Chrome extension tools)
            const allExtensionTools = getAllTools();

            // Filter extension tools based on workflow
            let extensionTools: Record<string, any>;
            if (workflowConfig) {
              // Workflow mode: Only allowed tools
              extensionTools = Object.fromEntries(
                Object.entries(allExtensionTools).filter(([name]) =>
                  workflowConfig.allowedTools.includes(name)
                )
              );
              log.info(' Filtered tools for workflow:', {
                workflow: workflowConfig.name,
                allowed: workflowConfig.allowedTools,
                filtered: Object.keys(extensionTools)
              });
            } else {
              // Normal mode: All tools except workflow-only
              extensionTools = Object.fromEntries(
                Object.entries(allExtensionTools).filter(([name]) =>
                  !workflowOnlyTools.includes(name)
                )
              );
              log.info(' Normal mode - excluding workflow-only tools:', {
                excluded: workflowOnlyTools,
                available: Object.keys(extensionTools)
              });
            }

            log.info(' Extension tools loaded:', {
              count: Object.keys(extensionTools).length,
              names: Object.keys(extensionTools)
            });

            // Get MCP tools from background service worker (not in workflow mode)
            let mcpTools = {};
            if (!workflowConfig) {
              try {
                const mcpManager = await getMCPToolsFromBackground(abortSignal);
                mcpTools = mcpManager.tools;
                log.info(' MCP tools loaded:', {
                  count: Object.keys(mcpTools).length,
                  names: Object.keys(mcpTools)
                });
              } catch (error) {
                log.warn(' MCP tools unavailable:', error);
              }
            }

            // Add agent tools (not in workflow mode unless allowed)
            const agentTools = workflowConfig ? {} : {
              analyzeYouTubeVideo: youtubeAgentAsTool,
            };
            log.info(' Agent tools loaded:', {
              count: Object.keys(agentTools).length,
              names: Object.keys(agentTools)
            });

            // Combine all tools
            tools = { ...extensionTools, ...agentTools, ...mcpTools };
            log.info(' Total tools available:', {
              count: Object.keys(tools).length,
              extension: Object.keys(extensionTools).length,
              mcp: Object.keys(mcpTools).length,
              agents: Object.keys(agentTools).length,
              workflowMode: !!workflowConfig
            });

            // Use remote or workflow-specific prompt
            systemPrompt = workflowConfig ? workflowConfig.systemPrompt : remoteSystemPrompt;
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
            try {
              return await streamText({
                model,
                messages: modelMessages,
                tools,
                system: enhancedPrompt,
                abortSignal,

                stopWhen: [stepCountIs(stepCount)],
                toolChoice: 'auto', // Let AI decide when to use tools
                maxRetries: 20, // Internal AI SDK retries for streaming issues
                temperature: 0.7,
                experimental_transform: smoothStream({
                  delayInMs: 20,
                  chunking: 'word',
                }),
                // Log when a step completes (includes tool calls)
                onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage, warnings, response }) => {
                  // Check for malformed function calls or errors
                  if (finishReason === 'error' || finishReason === 'other' || finishReason === 'unknown') {
                    log.error(' Step finished with error', {
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
                    log.error(' GEMINI MALFORMED_FUNCTION_CALL ERROR', {
                      finishReason: 'MALFORMED_FUNCTION_CALL',
                      generatedCode: malformedInfo.code?.substring(0, 500),
                      fullText: text?.substring(0, 200),
                    });

                    // Create and write detailed error
                    const malformedError = APIError.malformedFunctionCall(
                      `The model generated: ${malformedInfo.code?.substring(0, 200)}`,
                      undefined
                    );
                    writeErrorToStream(writer, malformedError, 'Malformed function call');
                  }

                  if (toolCalls && toolCalls.length > 0) {
                    log.info('Tools called:', {
                      count: toolCalls.length,
                      calls: toolCalls.map(call => ({
                        id: call.toolCallId,
                        name: call.toolName,
                        isAgentTool: call.toolName === 'analyzeYouTubeVideo',
                      })),
                    });
                  }

                  if (toolResults && toolResults.length > 0) {
                    log.info('Tool results:', {
                      count: toolResults.length,
                      results: toolResults.map(result => ({
                        id: result.toolCallId,
                        name: result.toolName,
                        status: 'output' in result ? 'success' : 'error',
                      })),
                    });
                  }

                  log.info('Step finished:', {
                    finishReason,
                    textLength: text?.length || 0,
                    tokensUsed: usage?.totalTokens || 0,
                  });
                },
                // Log when the entire stream finishes
                onFinish: async ({ text, finishReason, usage, steps }) => {
                  log.info('Stream finished:', {
                    finishReason,
                    textLength: text?.length || 0,
                    tokensUsed: usage?.totalTokens || 0,
                    stepCount: steps?.length || 0,
                    workflowMode: !!workflowId,
                    threadId: threadId || 'unknown'
                  });

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
                  const hitStepLimit = steps && steps.length >= stepCount;
                  const lastStepHasToolCalls = steps && steps.length > 0 &&
                    steps[steps.length - 1].toolCalls &&
                    steps[steps.length - 1].toolCalls.length > 0;

                  // If we hit the step limit, show continue button
                  // finishReason can be 'stop', 'length', 'tool-calls', etc.
                  if (hitStepLimit && finishReason) {
                    log.info('Step count limit reached - continue button should be shown', {
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
                      log.info(' WORKFLOW COMPLETION DETECTED - Ending workflow session', {
                        threadId,
                        workflowId
                      });
                      workflowSessionManager.endSession(threadId);
                    } else {
                      log.info(' Workflow still active - no completion marker found', {
                        threadId,
                        workflowId
                      });
                    }
                  }
                },
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
                onError?.(quotaError);

                throw quotaError;
              }              // Parse and enhance the error
              const enhancedError = parseGeminiError(streamError);

              // Log the error
              log.error('streamText error:', {
                errorCode: enhancedError.errorCode,
                retryable: isRetryableError(enhancedError),
                message: enhancedError.message,
              });

              // Throw enhanced error for retry manager to handle
              throw enhancedError;
            }
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
