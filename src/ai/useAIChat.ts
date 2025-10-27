/**
 * Custom React hook for AI chat using AI SDK v5
 * Uses SimpleFrontendTransport to call AI logic directly from the frontend
 */

import { useChat } from '@ai-sdk/react';
import { SimpleFrontendTransport } from './SimpleFrontendTransport';
import type { UIMessage } from 'ai';
import { useMemo, useCallback } from 'react';
import { createLogger } from '../logger';
import { formatErrorInline } from '../errors/errorMessages';
import { APIError, NetworkError, ErrorType } from '../errors';

const log = createLogger('useAIChat');

export interface UseAIChatOptions {
  threadId: string;
  initialMessages?: UIMessage[];
  onError?: (error: Error) => void;
  onFinish?: (message: any) => void;
}

/**
 * Custom hook for AI chat
 * Uses SimpleFrontendTransport for direct frontend AI backend
 */
export function useAIChat(options: UseAIChatOptions) {
  const { threadId, initialMessages, onError, onFinish } = options;

  // Create transport instance (memoized)
  const transport = useMemo(() => new SimpleFrontendTransport(), []);

  // Enhanced error handler that appends formatted error to messages
  const handleError = useCallback((error: Error) => {
    log.error('AI Chat error from here', error);

    // Format error for display
    const appError = error instanceof APIError || error instanceof NetworkError
      ? error
      : new APIError({
        message: error.message || String(error),
        retryable: false,
        userMessage: 'An error occurred while processing your request.',
        technicalDetails: error.message || String(error),
        errorCode: ErrorType.UNKNOWN_ERROR,
      });

    const errorMarkdown = formatErrorInline(appError);

    log.error('Formatted error message:', errorMarkdown);

    // Call user's onError callback with the formatted error
    onError?.(appError);

    // Note: The error is already written to the stream in aiLogic.ts
    // via writeErrorToStream(), so it will appear in the message
    // This callback is mainly for additional error handling (toasts, etc.)
  }, [onError]);

  // Use AI SDK's useChat hook with simple frontend transport
  const chat = useChat({
    id: threadId,
    transport,
    onError: handleError,
    onFinish: (finishResult) => {
      log.info('AI response finished', {
        messageId: finishResult.message.id,
        isError: finishResult.isError
      });
      onFinish?.(finishResult);
    },
  });

  return {
    ...chat,
    // Add custom cleanup method
    cleanup: () => {
      transport.cleanup(threadId);
    },
  };
}
