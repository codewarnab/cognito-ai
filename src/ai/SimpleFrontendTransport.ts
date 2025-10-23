/**
 * Simple Frontend Transport for AI SDK v5
 * Calls AI logic directly from the frontend
 * No service worker communication needed
 */

import type { UIMessage } from 'ai';
import { streamAIResponse } from './aiLogic';
import { createLogger } from '../logger';
import { loadThreadMessages, getThread } from '../db';
import { processMessagesWithMentions } from '../utils/mentionProcessor';
import { parseWorkflowCommand, isSlashCommand } from '../utils/slashCommandUtils';
import { getWorkflow } from '../workflows/registry';
import { workflowSessionManager } from '../workflows/sessionManager';

const log = createLogger('SimpleFrontendTransport');

/**
 * Simple transport implementation
 * Directly calls AI logic from the frontend
 */
export class SimpleFrontendTransport {
  private abortControllers = new Map<string, AbortController>();

  /**
   * Send messages to AI and get streaming response
   * Supports multiple trigger types including submit-tool-result
   */
  async sendMessages(params: {
    trigger: 'submit-message' | 'regenerate-message';
    chatId: string;
    messageId: string;
    messages: UIMessage[];
    abortSignal: AbortSignal;
  } & any): Promise<ReadableStream> {
    const { chatId, messages, abortSignal, trigger, id, messageId } = params;

    log.info('Sending messages', {
      chatId,
      count: messages.length,
      trigger: trigger || 'submit-message',
      id,
      messageId
    });

    // Create abort controller for this request
    const abortController = new AbortController();
    this.abortControllers.set(chatId, abortController);

    // Named handler for abort signal
    const onAbort = () => {
      log.info('Stream aborted by caller', { chatId });
      abortController.abort();
      this.abortControllers.delete(chatId);
    };

    // Handle abort signal from caller
    abortSignal?.addEventListener('abort', onAbort);

    // Cleanup function to remove listener and clean up resources
    const cleanup = () => {
      abortSignal?.removeEventListener('abort', onAbort);
      abortController.abort();
      this.abortControllers.delete(chatId);
    };

    try {
      // Handle different trigger types
      let requestMessages = messages;

      if (trigger === 'regenerate-message') {
        // For regenerating messages, use the existing messages
        log.info('Processing regenerate-message request', { messageId });
        requestMessages = messages;
      }

      // Process messages for tab mentions (extracts @[Tab](id) and adds context)
      requestMessages = await processMessagesWithMentions(requestMessages);

      // CRITICAL: Check for active workflow session FIRST
      // This ensures workflow context persists across tool calls
      let workflowId: string | undefined;
      const activeSession = workflowSessionManager.getSession(chatId);

      if (activeSession) {
        // Workflow session is active - use it
        workflowId = activeSession.workflowId;
        log.info('🔄 CONTINUING WORKFLOW SESSION', {
          threadId: chatId,
          workflowId: activeSession.workflowId,
          workflowName: activeSession.workflow.name,
          sessionAge: Date.now() - activeSession.startedAt
        });
      }

      // Check if the last user message contains a NEW workflow command
      const lastUserMessage = requestMessages
        .filter(m => m.role === 'user')
        .pop();

      if (lastUserMessage && !activeSession) {
        // Extract text from message parts
        let messageText = '';

        if (typeof lastUserMessage.content === 'string') {
          messageText = lastUserMessage.content;
        } else if (lastUserMessage.parts && Array.isArray(lastUserMessage.parts)) {
          // Get text from parts array
          const textPart = lastUserMessage.parts.find(p => p.type === 'text');
          if (textPart && 'content' in textPart && typeof textPart.content === 'string') {
            messageText = textPart.content;
          } else if (textPart && 'text' in textPart && typeof textPart.text === 'string') {
            messageText = textPart.text;
          }
        } else if ('text' in lastUserMessage && typeof lastUserMessage.text === 'string') {
          messageText = lastUserMessage.text;
        }

        log.info('🔍 Checking message for workflow command', {
          messageText,
          hasContent: !!lastUserMessage.content,
          hasParts: !!lastUserMessage.parts,
          hasText: !!(lastUserMessage as any).text
        });

        // Check if it's a workflow command
        if (messageText && isSlashCommand(messageText)) {
          log.info('🔍 Slash command detected in message', { messageText });

          const workflowCmd = parseWorkflowCommand(messageText);
          log.info('🔍 Parsed workflow command', { workflowCmd });

          if (workflowCmd) {
            const workflow = getWorkflow(workflowCmd.workflowId);

            if (workflow) {
              log.info('✅ WORKFLOW DETECTED - Starting workflow session', {
                workflowId: workflowCmd.workflowId,
                query: workflowCmd.query,
                fullMessage: messageText,
                workflowName: workflow.name,
                threadId: chatId
              });

              workflowId = workflowCmd.workflowId;

              // START WORKFLOW SESSION - This will persist across tool calls
              workflowSessionManager.startSession(chatId, workflow);

              // Strip the workflow command from the message, keep only the query
              const cleanedQuery = workflowCmd.query;

              // Update the last message to contain only the query
              if (lastUserMessage.parts && Array.isArray(lastUserMessage.parts)) {
                lastUserMessage.parts = lastUserMessage.parts.map(part => {
                  if (part.type === 'text') {
                    if ('content' in part && typeof part.content === 'string') {
                      return { ...part, content: cleanedQuery };
                    } else if ('text' in part && typeof part.text === 'string') {
                      return { ...part, text: cleanedQuery };
                    }
                  }
                  return part;
                });
              }

              // Also update content and text if they exist
              if (typeof lastUserMessage.content === 'string') {
                (lastUserMessage as any).content = cleanedQuery;
              }
              if ('text' in lastUserMessage && typeof (lastUserMessage as any).text === 'string') {
                (lastUserMessage as any).text = cleanedQuery;
              }

              log.info('📝 Cleaned message for workflow', {
                original: messageText,
                cleaned: cleanedQuery
              });
            } else {
              log.warn('Workflow not found', { workflowId: workflowCmd.workflowId });
            }
          } else {
            log.warn('Failed to parse workflow command', { messageText });
          }
        } else {
          log.info('Not a slash command, proceeding with regular AI', { messageText });
        }
      }

      // Get thread's initial page context for system prompt
      log.info('🔍 Preparing to call AI logic', {
        workflowMode: !!workflowId,
        workflowId: workflowId || 'none'
      });
      let initialPageContext: string | undefined;
      try {
        const thread = await getThread(chatId);
        initialPageContext = thread?.initialPageContext;
        if (initialPageContext) {
          log.info('📄 Using initial page context from thread', {
            threadId: chatId,
            contextLength: initialPageContext.length
          });
        }
      } catch (error) {
        log.warn('Failed to load thread context', error);
      }

      log.info('📤 Calling streamAIResponse...', {
        messageCount: requestMessages.length,
        hasAbortSignal: !!abortController.signal,
        hasInitialContext: !!initialPageContext,
        workflowMode: !!workflowId,
        workflowId: workflowId || 'none'
      });

      // Get the stream from AI logic
      const uiMessageStream = await streamAIResponse({
        messages: requestMessages,
        abortSignal: abortController.signal,
        initialPageContext,
        workflowId, // Pass workflow ID if detected or from active session
        threadId: chatId, // Pass thread ID for workflow session management
        onError: (error) => {
          log.error('AI response error', error);
        },
      });

      log.info('📥 Stream received from streamAIResponse, returning to caller');

      // Return the stream as ReadableStream
      // Note: Do NOT cleanup here - the stream needs to stay alive!
      // Cleanup will happen when the stream is consumed or aborted
      return uiMessageStream;
    } catch (error) {
      log.error('Transport error', error);
      // Only cleanup on error
      cleanup();
      throw error;
    }
  }

  /**
   * Get messages by thread ID from IndexedDB
   */
  async getMessagesById(params: { chatId: string }): Promise<UIMessage[]> {
    try {
      const dbMessages = await loadThreadMessages(params.chatId);

      // Convert ChatMessage to UIMessage format
      // Note: ChatMessage.message contains the complete UIMessage
      const uiMessages: UIMessage[] = dbMessages.map((msg) => ({
        id: msg.message?.id || msg.id,
        role: msg.message?.role || 'user',
        parts: msg.message?.parts || [
          {
            type: 'text' as const,
            text: msg.message?.content || '',
          }
        ],
      }));

      log.info('Loaded messages from DB', { chatId: params.chatId, count: uiMessages.length });
      return uiMessages;
    } catch (error) {
      log.error('Error loading messages', error);
      return [];
    }
  }

  /**
   * Cleanup method
   */
  cleanup(id: string) {
    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
      log.info('Cleaned up transport', { id });
    }
  }

  /**
   * Reconnect to an existing stream (not implemented for frontend)
   */
  async reconnectToStream(params: { chatId: string }): Promise<ReadableStream> {
    log.warn('Stream reconnection not implemented', params);
    throw new Error('Stream reconnection not supported in simple frontend transport');
  }
}

