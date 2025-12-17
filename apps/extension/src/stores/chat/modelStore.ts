/**
 * Model Store - AI model configuration state
 *
 * Manages:
 * - Current AI mode (local/remote/agent/adaptive)
 * - Selected remote model
 * - API key status
 * - Conversation start mode tracking
 */

import { create } from 'zustand';
import { chromeStorageSync } from '../middleware/chromeStorageSync';
import type { ModelState, AIMode, RemoteModel } from './types';

export const useModelStore = create<ModelState>()(
  chromeStorageSync<ModelState>({
    storageKey: 'ai_model_config',
    persistFields: ['mode', 'remoteModel'],
    onHydrate: () => {
      useModelStore.setState({ isHydrated: true });
    },
  })((set, get) => ({
    // Initial state
    mode: 'remote',
    remoteModel: 'gemini-3-flash-preview',
    hasApiKey: false,
    conversationStartMode: null,
    isLoading: true,
    isHydrated: false,

    // Actions
    setMode: (mode: AIMode) => {
      set({ mode, conversationStartMode: mode });
    },

    setRemoteModel: (remoteModel: RemoteModel) => {
      set({ remoteModel });
    },

    setConversationStartMode: (mode: AIMode | null) => {
      set({ conversationStartMode: mode });
    },

    clearConversationStartMode: () => {
      set({ conversationStartMode: null });
    },

    refreshApiKeyStatus: async () => {
      try {
        const result = await chrome.storage.local.get('ai_provider_config');
        const config = result.ai_provider_config;
        const hasKey = !!(config?.google?.apiKey);
        set({ hasApiKey: hasKey });
      } catch (error) {
        console.error('[ModelStore] Failed to refresh API key status:', error);
        set({ hasApiKey: false });
      }
    },

    initialize: async () => {
      await get().refreshApiKeyStatus();
      set({ isLoading: false });
    },
  }))
);
