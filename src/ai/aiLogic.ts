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
import { getMCPToolsFromBackground } from './mcpProxy';
import { youtubeAgentAsTool } from './agents/youtubeAgent';
import { getGeminiApiKey, hasGeminiApiKey } from '../utils/geminiApiKey';
import { getModelConfig } from '../utils/modelSettings';

const log = createLogger('AI-Logic');

/**
 * Stream AI response directly from the frontend
 * Returns a UIMessageStream that can be consumed by useChat
 * 
 * Handles both local (Gemini Nano) and remote (Gemini API) modes
 */
export async function streamAIResponse(params: {
  messages: UIMessage[];
  abortSignal?: AbortSignal;
  initialPageContext?: string;
  onError?: (error: Error) => void;
}) {
  const { messages, abortSignal, initialPageContext, onError } = params;

  log.info('Starting AI stream', { messageCount: messages.length });

  // Get current model configuration
  const modelConfig = await getModelConfig();

  // Determine mode based on API key availability
  let effectiveMode = modelConfig.mode;
  if (effectiveMode === 'remote') {
    const hasKey = await hasGeminiApiKey();
    if (!hasKey) {
      log.warn('⚠️ Remote mode requested but no API key, falling back to local');
      effectiveMode = 'local';
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

          if (effectiveMode === 'local') {
            // ========== LOCAL MODE (Gemini Nano) ==========
            log.info('🏠 Using LOCAL Gemini Nano');

            // Get local model
            model = builtInAI();

            // Get limited tool set (basic tools only)
            tools = getToolsForMode('local');
            log.info('🔧 Local tools available:', {
              count: Object.keys(tools).length,
              names: Object.keys(tools)
            });

            // Use local prompt
            systemPrompt = localSystemPrompt;

          } else {
            // ========== REMOTE MODE (Gemini API) ==========
            const modelName = modelConfig.remoteModel || 'gemini-2.5-flash';
            log.info('☁️ Using REMOTE model:', modelName);

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

            // Get full tool suite
            const extensionTools = getToolsForMode('remote');
            log.info('🔧 Extension tools loaded:', {
              count: Object.keys(extensionTools).length,
              names: Object.keys(extensionTools)
            });

            // Get MCP tools from background service worker
            let mcpTools = {};
            try {
              const mcpManager = await getMCPToolsFromBackground(abortSignal);
              mcpTools = mcpManager.tools;
              log.info('🔧 MCP tools loaded:', {
                count: Object.keys(mcpTools).length,
                names: Object.keys(mcpTools)
              });
            } catch (error) {
              log.warn('⚠️ MCP tools unavailable:', error);
            }

            // Add agent tools
            const agentTools = {
              analyzeYouTubeVideo: youtubeAgentAsTool,
            };
            log.info('🤖 Agent tools loaded:', {
              count: Object.keys(agentTools).length,
              names: Object.keys(agentTools)
            });

            // Combine all tools
            tools = { ...extensionTools, ...agentTools, ...mcpTools };
            log.info('🎯 Total tools available:', {
              count: Object.keys(tools).length,
              extension: Object.keys(extensionTools).length,
              mcp: Object.keys(mcpTools).length,
              agents: Object.keys(agentTools).length,
            });

            // Use remote prompt
            systemPrompt = remoteSystemPrompt;
          }

          // Build enhanced prompt with initial page context if available
          let enhancedPrompt = systemPrompt;
          if (initialPageContext) {
            enhancedPrompt += `\n\nCURRENT PAGE CONTEXT:\n${initialPageContext}`;
          }

          // Stream with appropriate configuration
          log.info('🚀 Starting streamText...', {
            mode: effectiveMode,
            toolCount: Object.keys(tools).length,
            hasInitialContext: !!initialPageContext
          });

          const result = await streamText({
            model,
            messages: convertToModelMessages(messages),
            tools,
            system: enhancedPrompt,
            abortSignal,
            stopWhen: [stepCountIs(effectiveMode === 'local' ? 5 : 10)],
            toolChoice: 'auto', // Force proper tool calling format
            temperature: 0.7,
            experimental_transform: smoothStream({
              delayInMs: 20, // optional: defaults to 10ms
              chunking: 'word', // optional: defaults to 'word'
            }),
            // Log when a step completes (includes tool calls)
            onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
              // Check for malformed function calls or errors
              if (finishReason === 'error' || finishReason === 'unknown') {
                log.error('❌ TOOL CALL ERROR DETECTED', {
                  finishReason,
                  text: text?.substring(0, 200),
                  hint: 'The AI may have tried to use invalid syntax. Check if it generated Python-style code instead of proper tool calling.'
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
              });
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
