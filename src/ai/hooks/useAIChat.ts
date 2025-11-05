/**
 * Custom React hook for AI chat using AI SDK v5
 * Uses SimpleFrontendTransport to call AI logic directly from the frontend
 */

import { useChat } from '@ai-sdk/react';
import { SimpleFrontendTransport } from '../transport/SimpleFrontendTransport';
import type { UIMessage } from 'ai';
import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { createLogger } from '../../logger';
import { formatErrorInline } from '../../errors/errorMessages';
import { APIError, NetworkError, ErrorType } from '../../errors';
import type { AppUsage } from '../types/usage';
import { getThreadUsage, updateThreadUsage } from '../../db';
import { debounce } from '../../utils/debounce';

const log = createLogger('useAIChat');

export interface UseAIChatOptions {
  threadId: string;
  initialMessages?: UIMessage[];
  onError?: (error: Error) => void;
  onFinish?: (message: any) => void;
  onContextWarning?: (percent: number) => void; // Callback for context limit warnings
}

/**
 * Custom hook for AI chat
 * Uses SimpleFrontendTransport for direct frontend AI backend
 */
export function useAIChat(options: UseAIChatOptions) {
  const { threadId, initialMessages, onError, onFinish, onContextWarning } = options;

  // Track current usage for this thread
  const [currentUsage, setCurrentUsage] = useState<AppUsage | null>(null);
  const lastWarningPercent = useRef<number | null>(null);

  // Create transport instance (memoized)
  const transport = useMemo(() => new SimpleFrontendTransport(), []);

  // Debounced usage update to prevent excessive re-renders
  const debouncedUsageUpdate = useCallback(
    debounce((usage: AppUsage) => {
      log.info('Debounced usage update', {
        totalTokens: usage.totalTokens,
        modelId: usage.modelId
      });
      setCurrentUsage(usage);

      // Persist to database (also debounced)
      if (threadId) {
        updateThreadUsage(threadId, usage).catch(err =>
          log.error('Failed to update thread usage:', err)
        );
      }

      // Check for context warnings
      if (usage.totalTokens && usage.context?.totalMax) {
        const percent = Math.round((usage.totalTokens / usage.context.totalMax) * 100);

        // Trigger warning at 85% and 95% thresholds
        if (percent >= 95 && lastWarningPercent.current !== 95) {
          lastWarningPercent.current = 95;
          onContextWarning?.(percent);
          log.warn('🔴 CRITICAL: Context limit at 95%', { percent, usage });
        } else if (percent >= 85 && percent < 95 && lastWarningPercent.current !== 85) {
          lastWarningPercent.current = 85;
          onContextWarning?.(percent);
          log.warn('⚠️ WARNING: Context limit at 85%', { percent, usage });
        } else if (percent < 85 && lastWarningPercent.current !== null) {
          // Reset warning state when back under threshold
          lastWarningPercent.current = null;
          log.info('✅ Context usage back to normal', { percent });
        }
      }
    }, 300), // 300ms debounce
    [threadId, onContextWarning]
  );

  // Set up usage update callback
  useEffect(() => {
    transport.setOnUsageUpdate((usage: AppUsage) => {
      log.info('Usage update received from stream', {
        totalTokens: usage.totalTokens,
        modelId: usage.modelId,
        threadId
      });

      // Use debounced update
      debouncedUsageUpdate(usage);
    });
  }, [transport, threadId, debouncedUsageUpdate]);

  // Load initial usage from database when thread changes
  // This ensures context resets when creating new threads
  useEffect(() => {
    if (threadId) {
      log.info('Thread changed - loading usage', { threadId });

      // Reset warning state on thread change
      lastWarningPercent.current = null;

      getThreadUsage(threadId)
        .then(usage => {
          if (usage) {
            log.info('Loaded initial usage from DB', {
              totalTokens: usage.totalTokens,
              threadId
            });
            setCurrentUsage(usage);
          } else {
            // Reset usage for new threads (Phase 5: Context Reset)
            log.info('✨ New thread - resetting usage to null', { threadId });
            setCurrentUsage(null);
          }
        })
        .catch(err => log.error('Failed to load thread usage:', err));
    }
  }, [threadId]);

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

  // Phase 5: Explicit reset method for context usage
  const resetUsage = useCallback(() => {
    log.info('🔄 Explicitly resetting usage', { threadId });
    setCurrentUsage(null);
    lastWarningPercent.current = null;
  }, [threadId]);

  return {
    ...chat,
    // Add usage tracking
    usage: currentUsage,
    // Add reset method for explicit usage reset
    resetUsage,
    // Add custom cleanup method
    cleanup: () => {
      transport.cleanup(threadId);
    },
  };
}
