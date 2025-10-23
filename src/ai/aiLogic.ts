/**
 * Frontend AI Logic
 * Direct AI backend integration using AI SDK v5
 * Runs directly in the UI thread, no service worker needed
 */

import { streamText, createUIMessageStream, convertToModelMessages, generateId, type UIMessage, stepCountIs, smoothStream } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createLogger } from '../logger';
import { systemPrompt } from './prompt';
import { getAllTools } from './toolRegistryUtils';
import { getMCPToolsFromBackground } from './mcpProxy';
import { getGeminiApiKey } from '../utils/geminiApiKey';
import { builtInAI } from "@built-in-ai/core";
import { youtubeAgentAsTool } from './agents/youtubeAgent';
import { getWorkflow } from '../workflows/registry';
import { workflowSessionManager } from '../workflows/sessionManager';

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

// ============================================================================
// Configuration
// ============================================================================

/**
 * Initialize Google AI with API key from storage
 * Falls back to chrome-ai if API key is not configured
 */
async function getGoogleAIInstance() {
  try {
    const apiKey = await getGeminiApiKey();

    if (!apiKey) {
      log.info('⚠️ Gemini API key not configured, falling back to chrome-ai');
      return builtInAI();
    }

    // Custom fetch to remove referrer header that causes 403 errors in Chrome extensions
    const customFetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      const newInit = { ...init };
      if (newInit.headers) {
        // Remove the Referer header to avoid 403 from Google API
        delete (newInit.headers as any).Referer;
      }
      return fetch(url, newInit);
    };

    const google = createGoogleGenerativeAI({ apiKey, fetch: customFetch });
    return google('gemini-2.5-flash');
  } catch (error) {
    log.error('Error getting Google AI instance', error);
    throw error;
  }
}

/**
 * Stream AI response directly from the frontend
 * Returns a UIMessageStream that can be consumed by useChat
 */
export async function streamAIResponse(params: {
  messages: UIMessage[];
  abortSignal?: AbortSignal;
  initialPageContext?: string;
  onError?: (error: Error) => void;
  workflowId?: string; // Optional workflow ID to use workflow-specific prompt and tools
  threadId?: string; // Thread ID for workflow session management
}) {
  const { messages, abortSignal, initialPageContext, onError, workflowId, threadId } = params;

  log.info('Starting AI stream', { messageCount: messages.length, workflowId: workflowId || 'none' });

  // Get MCP tools from background service worker's persistent connections
  // This replaces the old approach of creating new clients on every chat
  let mcpTools = {};
  let mcpCleanup: (() => Promise<void>) | null = null;
  let mcpSessionIds: Map<string, string> | null = null;

  try {
    const mcpManager = await getMCPToolsFromBackground(abortSignal);
    console.log("mcpManager from background proxy", mcpManager);
    mcpTools = mcpManager.tools;
    mcpCleanup = mcpManager.cleanup;
    mcpSessionIds = mcpManager.sessionIds;

    const mcpToolCount = Object.keys(mcpTools).length;
    log.info('🔍 Available MCP tools (from background):', { count: mcpToolCount, names: Object.keys(mcpTools) });

    // Log session info - sessions are managed by background service worker
    if (mcpSessionIds && mcpSessionIds.size > 0) {
      log.info('📝 Active MCP sessions (managed by background):', {
        count: mcpSessionIds.size,
        sessions: Array.from(mcpSessionIds.entries()).map(([id, sessionId]) => ({
          serverId: id,
          sessionId: sessionId.substring(0, 16) + '...' // Truncate for security
        }))
      });
    } else {
      log.info('📝 MCP sessions managed by background service worker with keep-alive');
    }
  } catch (error) {
    log.error('❌ Failed to get MCP tools from background:', error);
    mcpCleanup = null; // Ensure cleanup is null on error
  }

  try {
    // Create UI message stream
    log.info('Creating UI message stream...');

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        try {
          log.info('Stream execute function started');

          // Send initial status (transient - not saved to history)
          writer.write({
            type: 'data-status',
            id: 'status-' + generateId(),
            data: { status: 'processing', timestamp: Date.now() },
            transient: true,
          });

          // Get Google Gemini model
          log.info('Initializing AI model...');
          let model = await getGoogleAIInstance();
          log.info('✅ AI model initialized');

          // Convert UI messages to model format
          const modelMessages = convertToModelMessages(messages);

          // Check if we're in workflow mode
          let workflowConfig = null;
          if (workflowId) {
            workflowConfig = getWorkflow(workflowId);
            if (workflowConfig) {
              log.info('🔄 Workflow mode detected:', { workflowId, name: workflowConfig.name });
            } else {
              log.warn('⚠️ Invalid workflowId provided:', workflowId);
            }
          }

          // Get all registered tools (Chrome extension tools)
          const extensionTools = getAllTools();
          const extensionToolCount = Object.keys(extensionTools).length;

          log.info('🔍 Available extension tools:', { count: extensionToolCount, names: Object.keys(extensionTools) });

          // Define workflow-only tools (only available in workflow mode)
          const workflowOnlyTools = ['generateMarkdown', 'generatePDF'];

          // Filter tools based on workflow if active
          let filteredExtensionTools = extensionTools;
          if (workflowConfig) {
            filteredExtensionTools = Object.fromEntries(
              Object.entries(extensionTools).filter(([name]) =>
                workflowConfig.allowedTools.includes(name)
              )
            );
            log.info('🎯 Filtered tools for workflow:', {
              workflow: workflowConfig.name,
              allowed: workflowConfig.allowedTools,
              filtered: Object.keys(filteredExtensionTools)
            });
          } else {
            // In normal mode, exclude workflow-only tools
            filteredExtensionTools = Object.fromEntries(
              Object.entries(extensionTools).filter(([name]) =>
                !workflowOnlyTools.includes(name)
              )
            );
            log.info('🎯 Normal mode - excluding workflow-only tools:', {
              excluded: workflowOnlyTools,
              available: Object.keys(filteredExtensionTools)
            });
          }

          // Add specialist agents as tools (only if not in workflow mode or if workflow allows)
          const agentTools = workflowConfig ? {} : {
            analyzeYouTubeVideo: youtubeAgentAsTool,
          };

          // Combine tools: extension tools + agent tools + MCP tools (NO MCP tools in workflow mode)
          const tools = workflowConfig
            ? { ...filteredExtensionTools, ...agentTools } // Workflow mode: filtered tools (may include workflow-only tools)
            : { ...filteredExtensionTools, ...agentTools, ...mcpTools }; // Normal mode: all tools except workflow-only

          const totalToolCount = Object.keys(tools).length;

          log.info('🎯 Total available tools:', {
            count: totalToolCount,
            extension: Object.keys(filteredExtensionTools).length,
            agents: Object.keys(agentTools).length,
            mcp: workflowConfig ? 0 : Object.keys(mcpTools).length,
            names: Object.keys(tools),
            agentNames: Object.keys(agentTools),
            workflowMode: !!workflowConfig
          });

          if (totalToolCount === 0) {
            log.warn('⚠️ NO TOOLS REGISTERED! AI will not be able to use tools.');
          }

          // Build system prompt with initial page context if available
          // Use workflow system prompt if in workflow mode
          let enhancedSystemPrompt = workflowConfig ? workflowConfig.systemPrompt : systemPrompt;

          if (initialPageContext) {
            enhancedSystemPrompt = `${enhancedSystemPrompt}\n\n[INITIAL PAGE CONTEXT - Captured at thread start]\n${initialPageContext}\n\nNote: This is the page context from when this conversation started. If you navigate to different pages or need updated context, use the readPageContent or getActiveTab tools.`;
            log.info('📄 Enhanced system prompt with initial page context');
          }

          if (workflowConfig) {
            log.info('📋 Using workflow system prompt:', {
              workflow: workflowConfig.name,
              promptLength: enhancedSystemPrompt.length
            });
          }

          // Stream text from AI
          // Use workflow's stepCount if available, otherwise default to 10
          const stepCount = workflowConfig?.stepCount || 10;

          log.info('🚀 Calling streamText with Gemini API...', {
            messageCount: modelMessages.length,
            toolCount: totalToolCount,
            hasInitialContext: !!initialPageContext,
            stepCount,
            workflowMode: !!workflowConfig
          });

          // Track if we've seen a MALFORMED_FUNCTION_CALL error
          let hasMalformedError = false;
          let malformedErrorDetails = '';

          const result = streamText({
            model: model,
            system: enhancedSystemPrompt,
            messages: modelMessages,
            stopWhen: [stepCountIs(stepCount)],
            tools, // Include tools in the stream
            toolChoice: 'auto', // Let AI decide when to use tools
            abortSignal,
            maxRetries: 3, // Retry up to 3 times on errors (including malformed calls)
            temperature: 0.7,
            experimental_transform: smoothStream({
              delayInMs: 20,
              chunking: 'word',
            }),
            // Log when a step completes (includes tool calls)
            onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage, warnings, response }) => {
              // Check for malformed function calls or errors via finishReason
              // Gemini returns 'error' or 'other' when MALFORMED_FUNCTION_CALL occurs
              if (finishReason === 'error' || finishReason === 'other' || finishReason === 'unknown') {
                log.error('❌ MALFORMED FUNCTION CALL DETECTED', {
                  finishReason,
                  text: text?.substring(0, 200),
                  warnings: warnings,
                  responseInfo: response ? 'Response available' : 'No response',
                  hint: 'Malformed function call. AI SDK will automatically retry with error feedback.'
                });

                // The AI SDK automatically adds error context to conversation history
                // and retries (up to maxRetries). The model receives feedback like:
                // "The previous function call was malformed. Please use valid JSON format."
                log.info('🔄 AI SDK handling retry with error feedback', {
                  maxRetries: 3,
                  behavior: 'Automatic error feedback sent to model'
                });

                // Write a transient status message to inform user
                writer.write({
                  type: 'data-status',
                  id: 'retry-' + generateId(),
                  data: {
                    status: 'retrying',
                    message: 'Correcting tool call format...',
                    timestamp: Date.now()
                  },
                  transient: true,
                });
              }

              // CRITICAL: Check for MALFORMED_FUNCTION_CALL via finish reason
              // This happens when Gemini returns Python code instead of JSON function calls
              // The AI SDK's automatic retry doesn't help here because it's not malformed JSON,
              // it's fundamentally wrong (code generation instead of function calling)
              const malformedInfo = extractMalformedCallInfo(response);

              if (malformedInfo.isMalformed) {
                log.error('❌ GEMINI MALFORMED_FUNCTION_CALL ERROR', {
                  finishReason: 'MALFORMED_FUNCTION_CALL',
                  generatedCode: malformedInfo.code?.substring(0, 500),
                  fullText: text?.substring(0, 200),
                  hint: 'Gemini returned Python/code instead of a function call. This bypasses AI SDK retry.'
                });

                // Log the full generated code for debugging
                if (malformedInfo.code && malformedInfo.code.length > 0) {
                  log.info('📋 Full malformed code generated by Gemini:', malformedInfo.code);
                }

                // Write detailed error to stream with actionable guidance
                writer.write({
                  type: 'data-error',
                  id: 'malformed-' + generateId(),
                  data: {
                    error: 'MALFORMED_FUNCTION_CALL',
                    message: '⚠️ The AI model generated code instead of calling a tool properly. This is a known Gemini limitation.',
                    details: `The model tried to execute: ${malformedInfo.code?.substring(0, 200)}...`,
                    timestamp: Date.now(),
                    context: 'Function calling',
                    suggestions: [
                      'Try simplifying your request into smaller steps',
                      'Ask the model to perform one action at a time',
                      'Rephrase to avoid triggering code generation',
                      'If generating reports/PDFs, provide the content directly rather than asking to compute dates/values'
                    ],
                    technicalNote: 'Gemini sometimes generates Python code when it should use native function calls with pre-computed JSON values.'
                  },
                  transient: false,
                });

                // Important: The AI SDK's maxRetries won't help here because this isn't
                // a parsing error - Gemini fundamentally misunderstood the task.
                // The error is now logged for the user to see and adjust their request.
                log.warn('⚠️ MALFORMED_FUNCTION_CALL requires user intervention - AI SDK retry mechanism bypassed');
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

              // Check for workflow completion marker
              if (workflowId && threadId && text) {
                if (text.includes('[WORKFLOW_COMPLETE]')) {
                  log.info('🏁 WORKFLOW COMPLETION DETECTED - Ending workflow session', {
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
            },
          });

          // Merge AI stream with status stream
          log.info('✅ Gemini streamText result received, merging with UI stream...');

          writer.merge(
            result.toUIMessageStream({
              onError: (error) => {
                log.error('AI stream error', error);
                const errorMessage = error instanceof Error ? error.message : String(error);

                // Write error message to the stream so it appears in chat
                writer.write({
                  type: 'data-error',
                  id: 'error-' + generateId(),
                  data: {
                    error: errorMessage,
                    timestamp: Date.now(),
                    context: 'AI stream processing'
                  },
                  transient: false, // Keep error in history
                });

                onError?.(error instanceof Error ? error : new Error(errorMessage));
                return `❌ Error: ${errorMessage}`;
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
                // Connections managed by background service worker with keep-alive
                log.info('✅ MCP tools remain available for next chat');
              },
            })
          );
        } catch (error) {
          log.error('Stream execution error', error);
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Write error message to the stream so it appears in chat
          writer.write({
            type: 'data-error',
            id: 'error-' + generateId(),
            data: {
              error: errorMessage,
              timestamp: Date.now(),
              context: 'Stream execution'
            },
            transient: false, // Keep error in history
          });

          // Also write a text message for better visibility
          writer.write({
            type: 'text-delta',
            id: 'error-text-' + generateId(),
            delta: `\n\n❌ **Error occurred:** ${errorMessage}\n\nPlease try again or contact support if the issue persists.`,
          });

          // MCP connections are persistent - no cleanup needed
          // Connections managed by background service worker with keep-alive
          log.info('✅ MCP tools remain available for next chat');

          onError?.(error instanceof Error ? error : new Error(errorMessage));
          throw error;
        }
      },
    });

    log.info('✅ UI message stream created successfully, returning to caller');
    return stream;
  } catch (error) {
    log.error('❌ Error creating stream', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // MCP connections are persistent - no cleanup needed
    // Connections managed by background service worker with keep-alive
    log.info('✅ MCP tools remain available for next chat');

    // Call onError callback if provided
    onError?.(error instanceof Error ? error : new Error(errorMessage));

    // Re-throw with enhanced message
    throw new Error(`Failed to create AI stream: ${errorMessage}`);
  }
}
