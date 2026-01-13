/**
 * Custom React hook for AI chat using AI SDK v6
 * Uses SimpleFrontendTransport to call AI logic directly from the frontend
 * 
 * Syncs with useChatStore for centralized state management.
 */

import { useChat } from '@ai-sdk/react';
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { SimpleFrontendTransport } from '../transport/SimpleFrontendTransport';
import type { UIMessage } from 'ai';
import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { createLogger } from '~logger';
import { formatErrorInline } from '../../errors/errorMessages';
import { APIError, NetworkError, ErrorType } from '../../errors';
import type { AppUsage } from '../types/usage';
import { updateThreadUsage } from '../../db';
import { debounce } from '@/utils/general';
import { calculateUsageFromMessages } from '../utils/calculateUsageFromMessages';
import { useWindowVisibility } from '../../contexts/WindowVisibilityContext';
import { playNotificationSound } from '@/utils/notifications';
import {
  useChatStore,
  type ChatState,
  useSettingsStore,
  type SettingsState,
  useCliModeStore,
  type CliModeState,
} from '@/stores';

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
  const { threadId, onError, onFinish, onContextWarning } = options;

  // Get window visibility state for notification sound
  const { isUserAway } = useWindowVisibility();

  // Get backend mode state - used to conditionally disable auto-send
  // In backend mode, the tool execution loop is handled internally by streamBackendChatWithTools
  // so we should NOT auto-send when tool results are available (would cause double-loop)
  const useBackendMode = useSettingsStore((state: SettingsState) => state.useBackendMode);

  // When using the CLI provider, the tool loop is handled by the local bridge,
  // so we must NOT auto-send when tool results are present (would cause loops).
  const isCliProviderSelected = useCliModeStore((state: CliModeState) => state.isCliProviderSelected);
  const isCliBridgeMode = isCliProviderSelected;

  // Get chat store actions for syncing state
  const setStoreStatus = useChatStore((state: ChatState) => state.setStatus);
  const setStoreMessages = useChatStore((state: ChatState) => state.setMessages);
  const setStoreUsage = useChatStore((state: ChatState) => state.setUsage);

  // Get store messages for syncing FROM store (thread switching)
  const storeMessages = useChatStore((state: ChatState) => state.messages);
  const storeIsHydrated = useChatStore((state: ChatState) => state.isHydrated);

  // Track last thread ID to detect thread switches
  const lastThreadIdRef = useRef<string | null>(null);

  // Track current usage for this thread
  const [currentUsage, setCurrentUsage] = useState<AppUsage | null>(null);
  const lastWarningPercent = useRef<number | null>(null);

  // Store messages ref for notification preview
  const messagesRef = useRef<UIMessage[]>([]);

  // Track streaming status for conditional auto-send
  // This ref is used by sendAutomaticallyWhen to distinguish between:
  // 1. Tool results added during backend's internal loop (streaming = true, don't auto-send)
  // 2. Tool results added via HITL approval (streaming = false, do auto-send)
  const isStreamingRef = useRef<boolean>(false);

  // Track active request cycle to prevent double auto-send
  // Set to true BEFORE addToolOutput is called, reset when stream finishes
  const isInRequestCycleRef = useRef<boolean>(false);

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

      // Sync to store
      setStoreUsage(usage);

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
    [threadId, onContextWarning, setStoreUsage]
  );



  // Reset usage state when thread changes (for new threads)
  // Actual usage calculation happens from messages in the effect below
  useEffect(() => {
    if (!threadId || threadId === 'default') {
      return;
    }

    // Reset warning state on thread change
    lastWarningPercent.current = null;

    log.info('🔄 Thread changed, usage will be calculated from messages', { threadId });
  }, [threadId]);

  // Enhanced error handler that appends formatted error to messages
  const handleError = useCallback((error: Error) => {
    // Add defensive check for undefined/null error
    if (!error) {
      log.error('AI Chat error - received null/undefined error!', {
        errorValue: error,
        errorType: typeof error
      });

      // Create a fallback error
      const fallbackError = new APIError({
        message: 'Unknown error occurred',
        retryable: false,
        userMessage: 'An unexpected error occurred. Please try again.',
        technicalDetails: 'Error object was null or undefined',
        errorCode: ErrorType.UNKNOWN_ERROR,
      });

      const errorMarkdown = formatErrorInline(fallbackError);
      log.error('Formatted fallback error message:', errorMarkdown);
      onError?.(fallbackError);
      return;
    }

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

  // Set up transport listeners
  useEffect(() => {
    transport.setOnUsageUpdate(debouncedUsageUpdate);
    transport.setOnErrorCallback(handleError);

    // Set up finish callback for notification sound AND Chrome notification
    transport.setOnFinishCallback(() => {
      log.info('🔔 AI response completed, checking if user is away', { isUserAway });

      // Only trigger notifications if user is away (viewing another window)
      if (isUserAway) {
        log.info('🔊 User is away, playing notification sound');
        playNotificationSound().catch(err => {
          log.warn('Failed to play notification sound:', err);
        });

        // Send message to background to create Chrome notification
        log.info('📬 Sending notification request to background', { threadId });

        // Get the last assistant message for preview
        const messages = messagesRef.current;
        const lastAssistantMessage = messages
          .slice()
          .reverse()
          .find((msg: any) => msg.role === 'assistant');

        let messagePreview = 'Response complete. Click to view or continue.';
        if (lastAssistantMessage) {
          // Extract text content from the message parts
          const parts = (lastAssistantMessage as any).parts;
          if (parts && Array.isArray(parts)) {
            const textPart = parts.find((part: any) => part.type === 'text');
            if (textPart && textPart.text) {
              const text = textPart.text;
              messagePreview = text.substring(0, 100) + (text.length > 100 ? '...' : '');
            }
          }
        }

        // Send notification creation message to background
        chrome.runtime.sendMessage({
          type: 'ai/notification/create',
          payload: {
            threadId,
            title: 'AI Assistant Finished',
            message: messagePreview,
            timestamp: Date.now(),
          },
        }).catch(err => {
          log.warn('Failed to send notification message to background:', err);
        });
      } else {
        log.info('👀 User is viewing extension, skipping notifications');
      }
    });
  }, [transport, debouncedUsageUpdate, handleError, isUserAway, threadId]);

  // Use AI SDK's useChat hook with simple frontend transport
  const chat = useChat({
    id: threadId,
    transport,
    // Auto-send when all tool results are available (for human-in-the-loop approval flow)
    // In backend mode, we only auto-send when NOT streaming.
    // - During streaming: backend's internal loop handles auto-executed tools, don't auto-send
    // - When ready: user approved an HITL tool, auto-send to get AI's response
    sendAutomaticallyWhen: isCliBridgeMode
      ? () => false
      : useBackendMode
        ? (args) => {
          // Block auto-send while actively streaming (backend loop is handling tools)
          if (isStreamingRef.current) {
            log.info('🚫 Blocking auto-send during streaming');
            return false;
          }
          // Block if we're already in a request cycle (prevents double auto-send race condition)
          // This fixes the loop issue with MCP/stdio tools where addToolOutput triggers
          // sendAutomaticallyWhen before status updates to 'streaming'
          if (isInRequestCycleRef.current) {
            log.info('🚫 Blocking auto-send - already in request cycle');
            return false;
          }
          // Check if should auto-send, and if so, mark that we're starting a request cycle
          const shouldSend = lastAssistantMessageIsCompleteWithToolCalls(args);
          if (shouldSend) {
            log.info('✅ Auto-sending - marking request cycle active');
            isInRequestCycleRef.current = true;
          }
          return shouldSend;
        }
        : lastAssistantMessageIsCompleteWithToolCalls, // BYOK mode: Always use standard logic
    onError: handleError,
    onFinish: (finishResult) => {
      // Reset request cycle tracking - stream is complete
      isInRequestCycleRef.current = false;

      // Add null safety check for message - may not exist in all stream modes
      log.info('AI response finished', {
        messageId: finishResult?.message?.id || 'unknown',
        isError: finishResult?.isError ?? false,
        hasMessage: !!finishResult?.message,
      });
      // Sync status to store
      setStoreStatus('idle');
      onFinish?.(finishResult);
    },
  });

  // Sync chat status to store AND update streaming ref
  useEffect(() => {
    const status = chat.status;

    // Update streaming ref - critical for conditional auto-send in backend mode
    isStreamingRef.current = (status === 'submitted' || status === 'streaming');

    if (status === 'submitted' || status === 'streaming') {
      setStoreStatus(status);
    } else if (status === 'ready') {
      setStoreStatus('idle');
    } else if (status === 'error') {
      setStoreStatus('error');
    }
  }, [chat.status, setStoreStatus]);

  // Sync messages FROM store TO useChat when thread changes or on initial load
  // This is critical for thread switching - store loads from IndexedDB, we sync to useChat
  useEffect(() => {
    // Only sync if store is hydrated
    if (!storeIsHydrated) {
      log.info('⏳ Store not hydrated yet, skipping sync');
      return;
    }

    // Check if we need to sync:
    // 1. If we just switched threads (ref != current)
    // 2. OR if this is the first time we are seeing a valid threadId (ref is null)
    const shouldSync = lastThreadIdRef.current !== threadId;

    if (shouldSync) {
      log.info('🔄 Thread switch or initial load, syncing store messages to useChat', {
        from: lastThreadIdRef.current,
        to: threadId,
        storeMessageCount: storeMessages.length
      });

      // Sync store messages to useChat
      chat.setMessages(storeMessages);
    }

    // Update last thread ID
    lastThreadIdRef.current = threadId;
  }, [threadId, storeMessages, storeIsHydrated, chat.setMessages]);

  // Sync messages to store when they change
  useEffect(() => {
    if (chat.messages && chat.messages.length > 0) {
      setStoreMessages(chat.messages);
    }
  }, [chat.messages, setStoreMessages]);

  // Recalculate usage from messages whenever they change
  // This ensures the context indicator always shows up when messages are loaded
  useEffect(() => {
    if (!chat.messages || chat.messages.length === 0) {
      log.info('📊 No messages, keeping current usage state');
      return;
    }

    // Update messages ref for notification preview
    messagesRef.current = chat.messages;

    log.info('📊 Recalculating usage from messages', {
      messageCount: chat.messages.length,
      threadId
    });

    const calculatedUsage = calculateUsageFromMessages(chat.messages);

    if (calculatedUsage) {
      log.info('✅ Setting calculated usage from messages', {
        totalTokens: calculatedUsage.totalTokens,
        hasContext: !!calculatedUsage.context,
        threadId
      });
      setCurrentUsage(calculatedUsage);
    } else {
      log.info('⚠️ No usage data found in messages');
    }
  }, [chat.messages, threadId]);

  // Explicit reset method for context usage
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
    // Expose setter for external usage updates (e.g., from thread loading)
    setUsage: setCurrentUsage,
    // Expose addToolOutput for human-in-the-loop tool approval
    addToolOutput: chat.addToolOutput,
    // Add custom cleanup method
    cleanup: () => {
      transport.cleanup(threadId);
    },
  };
}

