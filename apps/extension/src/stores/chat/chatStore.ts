/**
 * Chat Store - Messages and thread management
 *
 * Manages:
 * - Current thread and messages
 * - Chat status (idle/submitted/streaming/error)
 * - Token usage tracking
 * - Input state
 *
 * Uses Immer for clean array mutations.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { UIMessage } from 'ai';
import type { ChatState, ChatStatus } from './types';
import type { AppUsage } from '@/types/ai/usage';

export const useChatStore = create<ChatState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      currentThreadId: null,
      messages: [],
      status: 'idle' as ChatStatus,
      isLoading: false,
      usage: null,
      contextWarningPercent: null,
      lastError: null,
      errorToast: null,
      input: '',
      isHydrated: false,

      // Thread Management
      setCurrentThreadId: (id: string | null) => {
        set({ currentThreadId: id });
      },

      createNewThread: async () => {
        const { createThread, setLastActiveThreadId } = await import('@/db');
        const thread = await createThread();

        set((state) => {
          state.currentThreadId = thread.id;
          state.messages = [];
          state.usage = null;
          state.contextWarningPercent = null;
          state.status = 'idle';
          state.lastError = null;
        });

        await setLastActiveThreadId(thread.id);
        return thread.id;
      },

      selectThread: async (threadId: string) => {
        const { loadThreadMessages, setLastActiveThreadId } = await import('@/db');
        const storedMessages = await loadThreadMessages(threadId);

        // Convert ChatMessage to UIMessage
        const uiMessages: UIMessage[] = storedMessages.map((msg) => msg.message);

        set((state) => {
          state.currentThreadId = threadId;
          state.messages = uiMessages;
          state.usage = null;
          state.contextWarningPercent = null;
          state.status = 'idle';
        });

        await setLastActiveThreadId(threadId);
      },

      clearChat: async () => {
        const threadId = get().currentThreadId;
        if (!threadId) return;

        const { clearThreadMessages } = await import('@/db');
        await clearThreadMessages(threadId);

        set((state) => {
          state.messages = [];
          state.usage = null;
          state.contextWarningPercent = null;
        });
      },

      // Messages - Immer enables direct mutations
      setMessages: (messages: UIMessage[]) => {
        set((state) => {
          state.messages = messages;
        });
      },

      addMessage: (message: UIMessage) => {
        set((state) => {
          state.messages.push(message);
        });
      },

      updateMessage: (id: string, updates: Partial<UIMessage>) => {
        set((state) => {
          const msg = state.messages.find((m) => m.id === id);
          if (msg) {
            Object.assign(msg, updates);
          }
        });
      },

      removeMessage: (id: string) => {
        set((state) => {
          const index = state.messages.findIndex((m) => m.id === id);
          if (index !== -1) {
            state.messages.splice(index, 1);
          }
        });
      },

      // Input
      setInput: (input: string) => {
        set({ input });
      },

      clearInput: () => {
        set({ input: '' });
      },

      // Usage
      setUsage: (usage: AppUsage | null) => {
        set((state) => {
          state.usage = usage;
          if (usage?.totalTokens && usage?.context?.totalMax) {
            const percent = Math.round((usage.totalTokens / usage.context.totalMax) * 100);
            state.contextWarningPercent = percent >= 85 ? percent : null;
          } else {
            state.contextWarningPercent = null;
          }
        });
      },

      resetUsage: () => {
        set((state) => {
          state.usage = null;
          state.contextWarningPercent = null;
        });
      },

      // Status
      setStatus: (status: ChatStatus) => {
        set((state) => {
          state.status = status;
          state.isLoading = status === 'submitted' || status === 'streaming';
        });
      },

      setError: (error: Error | null) => {
        set({ lastError: error });
      },

      showErrorToast: (message: string, details?: string) => {
        set({ errorToast: { message, details } });
      },

      dismissErrorToast: () => {
        set({ errorToast: null });
      },

      // Initialize
      initialize: async () => {
        const { getLastActiveThreadId, createThread, setLastActiveThreadId } = await import('@/db');

        let threadId = await getLastActiveThreadId();

        if (!threadId) {
          const thread = await createThread();
          threadId = thread.id;
          await setLastActiveThreadId(threadId);
        }

        await get().selectThread(threadId);
        set({ isHydrated: true });
      },
    }))
  )
);

// Selectors for common use cases
export const selectIsLoading = (state: ChatState) => state.isLoading;
export const selectMessages = (state: ChatState) => state.messages;
export const selectUsage = (state: ChatState) => state.usage;
export const selectStatus = (state: ChatState) => state.status;
export const selectCurrentThreadId = (state: ChatState) => state.currentThreadId;
