/**
* Settings Store
* 
* Centralized settings management with Chrome storage sync.
* Replaces scattered chrome.storage calls and useApiKey hook.
*/
import { create } from 'zustand';
import { chromeStorageSync } from '../middleware/chromeStorageSync';
import { STORAGE_KEYS } from '../constants';
import type { SettingsState } from './types';

export const useSettingsStore = create<SettingsState>()(
  chromeStorageSync<SettingsState>({
    storageKey: STORAGE_KEYS.SETTINGS,
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
      'useBackendMode',
      'backendModel',
      'providersConfig',
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
    useBackendMode: false,
    backendModel: 'gemini-2.0-flash',
    providersConfig: { providers: [] },
    isHydrated: false,

    // Actions
    /**
     * Sets the API key for a specific AI provider (google, anthropic, openai).
     * Also updates legacy storage for backward compatibility.
     */
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
    },

    setPreferredModel: (model) => set({ preferredModel: model }),

    setPreferredMode: (mode) => set({ preferredMode: mode }),

    /**
     * Toggles a built-in tool on or off in the user's preferences.
     */
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

    setUseBackendMode: (value) => set({ useBackendMode: value }),

    setBackendModel: (model) => set({ backendModel: model }),

    setProvidersConfig: (config) => set({ providersConfig: config }),

    // Computed helpers
    hasGoogleApiKey: () => !!get().googleApiKey,
    needsProviderSetup: () => !get().hasAnyProviderConfigured,
  }))
);


