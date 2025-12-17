/**
 * Settings Store
 * 
 * Centralized settings management with Chrome storage sync.
 * Replaces scattered chrome.storage calls and useApiKey hook.
 */
import { create } from 'zustand';
import { chromeStorageSync } from '../middleware/chromeStorageSync';
import type { SettingsState } from './types';

export const useSettingsStore = create<SettingsState>()(
  chromeStorageSync<SettingsState>({
    storageKey: 'cognito_settings',
    storageArea: 'local',
    debounceMs: 200,
    persistFields: [
      'googleApiKey',
      'anthropicApiKey',
      'openaiApiKey',
      'preferredModel',
      'preferredMode',
      'enableVoiceMode',
      'enableNotificationSound',
      'showSearchToggle',
      'enabledBuiltInTools',
      'logLevel',
      'logCategories',
      'theme',
      'compactMode',
    ],
    onHydrate: () => {
      // Mark as hydrated after loading from storage
      useSettingsStore.setState({ isHydrated: true });
    },
  })((set, get) => ({
    // Initial state
    hasAnyProviderConfigured: false,
    googleApiKey: null,
    anthropicApiKey: null,
    openaiApiKey: null,
    preferredModel: 'gemini-3-flash-preview',
    preferredMode: 'remote',
    enableVoiceMode: true,
    enableNotificationSound: true,
    showSearchToggle: true,
    enabledBuiltInTools: ['getCurrentTime', 'createReminder'],
    logLevel: 'info',
    logCategories: [],
    theme: 'dark',
    compactMode: false,
    isHydrated: false,

    // Actions
    setApiKey: async (provider, key) => {
      const keyField = `${provider}ApiKey` as keyof SettingsState;
      const state = get();

      set({
        [keyField]: key,
        hasAnyProviderConfigured: !!(
          key ||
          (provider !== 'google' && state.googleApiKey) ||
          (provider !== 'anthropic' && state.anthropicApiKey) ||
          (provider !== 'openai' && state.openaiApiKey)
        ),
      } as Partial<SettingsState>);

      // Also update legacy storage for backward compatibility during migration
      if (provider === 'google') {
        await chrome.storage.local.set({
          ai_provider_config: { google: { apiKey: key } },
        });
      }
    },

    setPreferredModel: (model) => set({ preferredModel: model }),

    setPreferredMode: (mode) => set({ preferredMode: mode }),

    toggleTool: (toolId, enabled) => {
      const tools = [...get().enabledBuiltInTools];
      const index = tools.indexOf(toolId);

      if (enabled && index === -1) {
        tools.push(toolId);
      } else if (!enabled && index !== -1) {
        tools.splice(index, 1);
      }

      set({ enabledBuiltInTools: tools });
    },

    setLogLevel: (level) => set({ logLevel: level }),

    setTheme: (theme) => set({ theme }),

    setCompactMode: (compact) => set({ compactMode: compact }),

    setEnableVoiceMode: (enabled) => set({ enableVoiceMode: enabled }),

    setEnableNotificationSound: (enabled) => set({ enableNotificationSound: enabled }),

    loadFromStorage: async () => {
      // Load from legacy storage locations for migration
      const [providerConfig, modelConfig] = await Promise.all([
        chrome.storage.local.get('ai_provider_config'),
        chrome.storage.local.get('ai_model_config'),
      ]);

      const updates: Partial<SettingsState> = {};

      // Migrate provider config
      const providers = providerConfig.ai_provider_config;
      if (providers?.google?.apiKey) {
        updates.googleApiKey = providers.google.apiKey;
        updates.hasAnyProviderConfigured = true;
      }

      // Migrate model config
      const model = modelConfig.ai_model_config;
      if (model?.mode) {
        updates.preferredMode = model.mode;
      }
      if (model?.remoteModel) {
        updates.preferredModel = model.remoteModel;
      }

      if (Object.keys(updates).length > 0) {
        set(updates);
      }
    },

    // Computed helpers
    hasGoogleApiKey: () => !!get().googleApiKey,
    needsProviderSetup: () => !get().hasAnyProviderConfigured,
  }))
);

// Initialize: load from legacy storage on first import
useSettingsStore.getState().loadFromStorage();
