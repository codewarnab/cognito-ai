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
import { youtubeAgentAsTool } from './agents/youtubeAgent';

const log = createLogger('AI-Logic');


// ============================================================================
// Configuration
// ============================================================================

/**
 * Get Google AI instance with API key from storage or environment

async function GoogleAI() {
  try {
    const result = await chrome.storage.local.get(['googleApiKey']);

    
    if (!apiKey) {
      throw new Error('Google API key not configured. Please set it in extension settings.');
    }


    return google;
  } catch (error) {
    log.error('Error getting Google AI instance', error);
    throw error;
  }
} */

// Initialize Google AI
const apiKey = "AIzaSyAxTFyeqmms2eV9zsp6yZpCSAHGZebHzqc";
const google = createGoogleGenerativeAI({ apiKey });

/**
 * Stream AI response directly from the frontend
 * Returns a UIMessageStream that can be consumed by useChat
 */
export async function streamAIResponse(params: {
  messages: UIMessage[];
  abortSignal?: AbortSignal;
  initialPageContext?: string;
  onError?: (error: Error) => void;
}) {
  const { messages, abortSignal, initialPageContext, onError } = params;

  log.info('Starting AI stream', { messageCount: messages.length });

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

          // Get Google   i model
          log.info('Initializing Gemini model...');
          const model = google('gemini-2.5-flash');

          // Convert UI messages to model format
          const modelMessages = convertToModelMessages(messages);

          // Get all registered tools (Chrome extension tools)
          const extensionTools = getAllTools();
          const extensionToolCount = Object.keys(extensionTools).length;

          log.info('🔍 Available extension tools:', { count: extensionToolCount, names: Object.keys(extensionTools) });

          // Add specialist agents as tools
          const agentTools = {
            analyzeYouTubeVideo: youtubeAgentAsTool,
          };

          // Combine all tools: extension tools + agent tools + MCP tools
          const tools = { ...extensionTools, ...agentTools, ...mcpTools };
          const totalToolCount = Object.keys(tools).length;

          log.info('🎯 Total available tools:', {
            count: totalToolCount,
            extension: extensionToolCount,
            agents: Object.keys(agentTools).length,
            mcp: Object.keys(mcpTools).length,
            names: Object.keys(tools),
            agentNames: Object.keys(agentTools),
          });

          if (totalToolCount === 0) {
            log.warn('⚠️ NO TOOLS REGISTERED! AI will not be able to use tools.');
          }

          // Build system prompt with initial page context if available
          let enhancedSystemPrompt = systemPrompt;
          if (initialPageContext) {
            enhancedSystemPrompt = `${systemPrompt}\n\n[INITIAL PAGE CONTEXT - Captured at thread start]\n${initialPageContext}\n\nNote: This is the page context from when this conversation started. If you navigate to different pages or need updated context, use the readPageContent or getActiveTab tools.`;
            log.info('📄 Enhanced system prompt with initial page context');
          }

          // Stream text from AI
          log.info('🚀 Calling streamText with Gemini API...', {
            messageCount: modelMessages.length,
            toolCount: totalToolCount,
            hasInitialContext: !!initialPageContext
          });

          const result = streamText({
            model,
            system: enhancedSystemPrompt,
            messages: modelMessages,
            stopWhen: [stepCountIs(10)],
            tools, // Include tools in the stream
            toolChoice: 'auto', // Force proper tool calling format
            abortSignal,
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
