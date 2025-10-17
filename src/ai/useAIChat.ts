/**
 * Custom React hook for AI chat using AI SDK v5
 * Uses SimpleFrontendTransport to call AI logic directly from the frontend
 */

import { useChat } from '@ai-sdk/react';
import { SimpleFrontendTransport } from './SimpleFrontendTransport';
import type { UIMessage } from 'ai';
import { useMemo } from 'react';
import { createLogger } from '../logger';

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

  // Use AI SDK's useChat hook with simple frontend transport
  const chat = useChat({
    id: threadId,
    transport,
    onError: (error) => {
      log.error('AI Chat error', error);
      onError?.(error);
    },
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
