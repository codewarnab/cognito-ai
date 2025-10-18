/**
 * Frontend AI Logic
 * Direct AI backend integration using AI SDK v5
 * Runs directly in the UI thread, no service worker needed
 */

import { streamText, createUIMessageStream, convertToModelMessages, generateId, type UIMessage, stepCountIs } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createLogger } from '../logger';
import { systemPrompt } from './prompt';
import { getAllTools } from './toolRegistry';
import { initializeMCPClients } from './mcpClient';

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
const apiKey = "AIzaSyAdqyd9kSD_12B_WQ4Fm-Qk6IcL-6p5wjE";
const google = createGoogleGenerativeAI({ apiKey });

/**
 * Stream AI response directly from the frontend
 * Returns a UIMessageStream that can be consumed by useChat
 */
export async function streamAIResponse(params: {
  messages: UIMessage[];
  abortSignal?: AbortSignal;
  onError?: (error: Error) => void;
}) {
  const { messages, abortSignal, onError } = params;

  log.info('Starting AI stream', { messageCount: messages.length });

  // Initialize MCP clients and get their tools
  let mcpTools = {};
  let mcpCleanup: (() => Promise<void>) | null = null;
  let mcpSessionIds: Map<string, string> | null = null;

  try {
    const mcpManager = await initializeMCPClients(abortSignal);
    mcpTools = mcpManager.tools;
    mcpCleanup = mcpManager.cleanup;
    mcpSessionIds = mcpManager.sessionIds;

    const mcpToolCount = Object.keys(mcpTools).length;
    log.info('🔍 Available MCP tools:', { count: mcpToolCount, names: Object.keys(mcpTools) });

    // Log active sessions - these enable reconnection and state persistence
    if (mcpSessionIds && mcpSessionIds.size > 0) {
      log.info('📝 Active MCP sessions (enables auto-reconnection):', {
        count: mcpSessionIds.size,
        sessions: Array.from(mcpSessionIds.entries()).map(([id, sessionId]) => ({
          serverId: id,
          sessionId: sessionId.substring(0, 16) + '...' // Truncate for security
        }))
      });

      // Session IDs provide these benefits:
      // 1. Automatic reconnection with state preservation
      // 2. Server can track which client is making requests
      // 3. Long-running operations can resume after disconnect
      // 4. Server-side caching/optimization per session
    }
  } catch (error) {
    log.error('❌ Failed to initialize MCP clients:', error);
    mcpCleanup = null; // Ensure cleanup is null on error
  }

  try {
    // Create UI message stream

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        try {
          // Send initial status (transient - not saved to history)
          writer.write({
            type: 'data-status',
            id: 'status-' + generateId(),
            data: { status: 'processing', timestamp: Date.now() },
            transient: true,
          });

          // Get Google Gemini model
          const model = google('gemini-2.5-flash');

          // Convert UI messages to model format
          const modelMessages = convertToModelMessages(messages);

          // Get all registered tools (Chrome extension tools)
          const extensionTools = getAllTools();
          const extensionToolCount = Object.keys(extensionTools).length;

          log.info('🔍 Available extension tools:', { count: extensionToolCount, names: Object.keys(extensionTools) });

          // Combine all tools
          const tools = { ...extensionTools, ...mcpTools };
          const totalToolCount = Object.keys(tools).length;

          log.info('🎯 Total available tools:', {
            count: totalToolCount,
            extension: extensionToolCount,
            mcp: Object.keys(mcpTools).length,
            names: Object.keys(tools)
          });

          if (totalToolCount === 0) {
            log.warn('⚠️ NO TOOLS REGISTERED! AI will not be able to use tools.');
          }

          // Stream text from AI
          const result = streamText({
            model,
            system: systemPrompt,
            messages: modelMessages,
            stopWhen: [stepCountIs(10)],
            tools, // Include tools in the stream
            abortSignal,
            temperature: 0.7,
            // Log when a step completes (includes tool calls)
            onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
              if (toolCalls && toolCalls.length > 0) {
                log.info('Tools called:', {
                  count: toolCalls.length,
                  calls: toolCalls.map(call => ({
                    id: call.toolCallId,
                    name: call.toolName,
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
          });

          // Merge AI stream with status stream
          writer.merge(
            result.toUIMessageStream({
              onError: (error) => {
                log.error('AI stream error', error);
                onError?.(error instanceof Error ? error : new Error(String(error)));
                return error instanceof Error ? error.message : String(error);
              },
              onFinish: async ({ messages: finalMessages }) => {
                // Send completion status
                writer.write({
                  type: 'data-status',
                  id: 'status-' + generateId(),
                  data: { status: 'completed', timestamp: Date.now() },
                  transient: true,
                });

                // Clean up MCP clients
                if (mcpCleanup) {
                  try {
                    await mcpCleanup();
                    log.info('✅ MCP clients cleaned up');
                  } catch (error) {
                    log.error('❌ Error cleaning up MCP clients:', error);
                  }
                }

                log.info('AI stream completed', { messageCount: finalMessages.length });
              },
            })
          );
        } catch (error) {
          log.error('Stream execution error', error);

          // Clean up MCP clients on error
          if (mcpCleanup) {
            try {
              await mcpCleanup();
              log.info('✅ MCP clients cleaned up after error');
            } catch (cleanupError) {
              log.error('❌ Error cleaning up MCP clients after error:', cleanupError);
            }
          }

          onError?.(error instanceof Error ? error : new Error(String(error)));
          throw error;
        }
      },
    });

    return stream;
  } catch (error) {
    log.error('Error creating stream', error);

    // Clean up MCP clients on error
    if (mcpCleanup) {
      try {
        await mcpCleanup();
        log.info('✅ MCP clients cleaned up after stream creation error');
      } catch (cleanupError) {
        log.error('❌ Error cleaning up MCP clients after stream creation error:', cleanupError);
      }
    }

    throw error;
  }
}
