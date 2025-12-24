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
import { setAutoFreeze } from 'immer';
import type { UIMessage } from 'ai';
import type { ChatState, ChatStatus } from './types';
import type { AppUsage } from '@/types/ai/usage';

// Disable Immer's auto-freeze to prevent "Cannot add property" errors
// The AI SDK internally modifies message objects during stream processing
// and expects mutable objects
setAutoFreeze(false);

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

      /**
       * Creates a new chat thread and sets it as active.
       * Resets local message state.
       */
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

      /**
       * Selects an existing thread and loads its messages.
       * @param threadId - ID of the thread to load
       */
      selectThread: async (threadId: string) => {
        const { loadThreadMessages, setLastActiveThreadId } = await import('@/db');
        const storedMessages = await loadThreadMessages(threadId);

        // Convert ChatMessage to UIMessage
        const uiMessages: UIMessage[] = storedMessages.map((msg) => msg.message);

        // Use partial object update to avoid TypeScript deep type instantiation issues
        set({
          currentThreadId: threadId,
          messages: uiMessages,
          usage: null,
          contextWarningPercent: null,
          status: 'idle' as ChatStatus,
        });

        await setLastActiveThreadId(threadId);
      },

      /**
       * Clears all messages from the current thread.
       */
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
        // Use object-based set to avoid TypeScript deep type instantiation issues
        set({ messages });
      },

      addMessage: (message: UIMessage) => {
        // Use immutable pattern to avoid TypeScript deep type issues
        set({ messages: [...get().messages, message] });
      },

      updateMessage: (id: string, updates: Partial<UIMessage>) => {
        // Use immutable pattern to avoid TypeScript deep type issues
        set({
          messages: get().messages.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        });
      },

      removeMessage: (id: string) => {
        // Use immutable pattern to avoid TypeScript deep type issues
        set({ messages: get().messages.filter((m) => m.id !== id) });
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
        // Use object-based set to avoid TypeScript deep type instantiation issues with Immer
        const contextWarningPercent = (usage?.totalTokens && usage?.context?.totalMax)
          ? (Math.round((usage.totalTokens / usage.context.totalMax) * 100) >= 85
            ? Math.round((usage.totalTokens / usage.context.totalMax) * 100)
            : null)
          : null;
        set({ usage, contextWarningPercent });
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
