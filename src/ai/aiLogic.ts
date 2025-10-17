/**
 * Frontend AI Logic
 * Direct AI backend integration using AI SDK v5
 * Runs directly in the UI thread, no service worker needed
 */

import { streamText, createUIMessageStream, convertToModelMessages, generateId, type UIMessage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createLogger } from '../logger';
import { systemPrompt } from './prompt';
import { getAllTools } from './toolRegistry';

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

          // Get all registered tools
          const tools = getAllTools();
          const toolCount = Object.keys(tools).length;
          
          log.info('🔍 Available tools:', { count: toolCount, names: Object.keys(tools) });
          
          if (toolCount === 0) {
            log.warn('⚠️ NO TOOLS REGISTERED! AI will not be able to use tools.');
          }

          // Stream text from AI
          const result = streamText({
            model,
            system: systemPrompt,
            messages: modelMessages,
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

                log.info('AI stream completed', { messageCount: finalMessages.length });
              },
            })
          );
        } catch (error) {
          log.error('Stream execution error', error);
          onError?.(error instanceof Error ? error : new Error(String(error)));
          throw error;
        }
      },
    });

    return stream;
  } catch (error) {
    log.error('Error creating stream', error);
    throw error;
  }
}
