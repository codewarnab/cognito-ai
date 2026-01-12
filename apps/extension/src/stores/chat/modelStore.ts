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
import { STORAGE_KEYS } from '../constants';
import type { ModelState, AIMode, RemoteModel } from './types';
import { useSettingsStore } from '../settings/settingsStore';

export const useModelStore = create<ModelState>()(
  chromeStorageSync<ModelState>({
    storageKey: STORAGE_KEYS.MODEL_CONFIG,
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
    /**
     * Sets the current AI mode (local, remote, agent, adaptive).
     * Also updates the conversation start mode.
     */
    setMode: (mode: AIMode) => {
      set({ mode, conversationStartMode: mode });
    },

    /**
     * Sets the selected remote model (e.g., gemini-1.5-pro, claude-3-sonnet).
     */
    setRemoteModel: (remoteModel: RemoteModel) => {
      set({ remoteModel });
    },

    setConversationStartMode: (mode: AIMode | null) => {
      set({ conversationStartMode: mode });
    },

    clearConversationStartMode: () => {
      set({ conversationStartMode: null });
    },

    /**
     * Checks if a valid API key is configured for the current provider.
     * Updates the `hasApiKey` state.
     */
    refreshApiKeyStatus: async () => {
      const settings = useSettingsStore.getState();
      set({ hasApiKey: !!settings.googleApiKey });
    },

    initialize: async () => {
      await get().refreshApiKeyStatus();
      set({ isLoading: false });
    },
  }))
);
