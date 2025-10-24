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
import { getGeminiApiKey, hasGeminiApiKey } from '../utils/geminiApiKey';
import { getModelConfig } from '../utils/modelSettings';

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
 * Stream AI response directly from the frontend
 * Returns a UIMessageStream that can be consumed by useChat
 * 
 * Handles both local (Gemini Nano) and remote (Gemini API) modes
 * Also supports workflow mode with custom prompts and tool filtering
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
            log.info(' Using LOCAL Gemini Nano');

            // Get local model
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
              log.info(' Filtered local tools for workflow:', {
                workflow: workflowConfig.name,
                allowed: workflowConfig.allowedTools,
                filtered: Object.keys(tools)
              });
            } else {
              tools = localTools;
            }

            log.info(' Local tools available:', {
              count: Object.keys(tools).length,
              names: Object.keys(tools)
            });

            // Use local or workflow-specific prompt
            systemPrompt = workflowConfig ? workflowConfig.systemPrompt : localSystemPrompt;

          } else {
            // ========== REMOTE MODE (Gemini API) ==========
            const modelName = modelConfig.remoteModel || 'gemini-2.5-flash';
            log.info(' Using REMOTE model:', modelName);

            // Get API key
            const apiKey = await getGeminiApiKey();
            if (!apiKey) {
              throw new Error('API key required for remote mode');
            }

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
            const workflowOnlyTools = ['generateMarkdown', 'generatePDF'];

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
          let enhancedPrompt = systemPrompt;
          if (initialPageContext) {
            enhancedPrompt = `${enhancedPrompt}\n\n[INITIAL PAGE CONTEXT - Captured at thread start]\n${initialPageContext}\n\nNote: This is the page context from when this conversation started. If you navigate to different pages or need updated context, use the readPageContent or getActiveTab tools.`;
            log.info(' Enhanced system prompt with initial page context');
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
          const stepCount = workflowConfig?.stepCount || (effectiveMode === 'local' ? 5 : 10);

          // Stream with appropriate configuration
          log.info(' Starting streamText...', {
            mode: effectiveMode,
            toolCount: Object.keys(tools).length,
            hasInitialContext: !!initialPageContext,
            stepCount,
            workflowMode: !!workflowConfig
          });

          const result = await streamText({
            model,
            messages: modelMessages,
            tools,
            system: enhancedPrompt,
            abortSignal,
            
            stopWhen: [stepCountIs(stepCount)],
            toolChoice: 'auto', // Let AI decide when to use tools
            maxRetries: 20, // Retry up to 3 times on errors
            temperature: 0.7,
            experimental_transform: smoothStream({
              delayInMs: 20,
              chunking: 'word',
            }),
            // Log when a step completes (includes tool calls)
            onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage, warnings, response }) => {
              // Check for malformed function calls or errors
              if (finishReason === 'error' || finishReason === 'other' || finishReason === 'unknown') {
                log.error(' MALFORMED FUNCTION CALL DETECTED', {
                  finishReason,
                  text: text?.substring(0, 200),
                  warnings: warnings,
                  responseInfo: response ? 'Response available' : 'No response',
                  hint: 'Malformed function call. AI SDK will automatically retry with error feedback.'
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

              // Check for MALFORMED_FUNCTION_CALL via response
              const malformedInfo = extractMalformedCallInfo(response);
              if (malformedInfo.isMalformed) {
                log.error(' GEMINI MALFORMED_FUNCTION_CALL ERROR', {
                  finishReason: 'MALFORMED_FUNCTION_CALL',
                  generatedCode: malformedInfo.code?.substring(0, 500),
                  fullText: text?.substring(0, 200),
                  hint: 'Gemini returned Python/code instead of a function call.'
                });

                // Write detailed error to stream
                writer.write({
                  type: 'data-error',
                  id: 'malformed-' + generateId(),
                  data: {
                    error: 'MALFORMED_FUNCTION_CALL',
                    message: ' The AI model generated code instead of calling a tool properly.',
                    details: `The model tried to execute: ${malformedInfo.code?.substring(0, 200)}...`,
                    timestamp: Date.now(),
                    context: 'Function calling',
                    suggestions: [
                      'Try simplifying your request into smaller steps',
                      'Ask the model to perform one action at a time',
                      'Rephrase to avoid triggering code generation'
                    ]
                  },
                  transient: false,
                });
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

          // Merge AI stream with status stream
          log.info(' AI streamText result received, merging with UI stream...');

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
                return ` Error: ${errorMessage}`;
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
            delta: `\n\n **Error occurred:** ${errorMessage}\n\nPlease try again or contact support if the issue persists.`,
          });

          onError?.(error instanceof Error ? error : new Error(errorMessage));
          throw error;
        }
      },
    });

    log.info(' UI message stream created successfully, returning to caller');
    return stream;
  } catch (error) {
    log.error(' Error creating stream', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Call onError callback if provided
    onError?.(error instanceof Error ? error : new Error(errorMessage));

    // Re-throw with enhanced message
    throw new Error(`Failed to create AI stream: ${errorMessage}`);
  }
}
