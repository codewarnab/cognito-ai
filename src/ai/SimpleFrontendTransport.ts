/**
 * Simple Frontend Transport for AI SDK v5
 * Calls AI logic directly from the frontend
 * No service worker communication needed
 */

import type { UIMessage } from 'ai';
import { streamAIResponse } from './aiLogic';
import { createLogger } from '../logger';
import { loadThreadMessages } from '../db';
import { processMessagesWithMentions } from '../utils/mentionProcessor';

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
    chatId: string;
    messages: UIMessage[];
    abortSignal: AbortSignal;
    trigger?: 'submit-user-message' | 'submit-tool-result' | 'regenerate-assistant-message';
    id?: string;
    messageId?: string;
  }): Promise<ReadableStream> {
    const { chatId, messages, abortSignal, trigger, id, messageId } = params;

    log.info('Sending messages', {
      chatId,
      count: messages.length,
      trigger: trigger || 'submit-user-message',
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

      if (trigger === 'submit-tool-result') {
        // For tool results, include complete message context
        log.info('Processing submit-tool-result request', { messageId });
        // Messages already include tool results from useChat
        requestMessages = messages;
      }

      // Process messages for tab mentions (extracts @[Tab](id) and adds context)
      requestMessages = await processMessagesWithMentions(requestMessages);

      log.info('📤 Calling streamAIResponse...', {
        messageCount: requestMessages.length,
        hasAbortSignal: !!abortController.signal
      });

      // Get the stream from AI logic
      const uiMessageStream = await streamAIResponse({
        messages: requestMessages,
        abortSignal: abortController.signal,
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
      const uiMessages: UIMessage[] = dbMessages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        parts: [
          {
            type: 'text' as const,
            text: msg.content,
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

