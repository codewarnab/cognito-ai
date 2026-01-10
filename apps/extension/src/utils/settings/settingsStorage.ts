/**
 * Settings storage utilities for user-configurable preferences
 */
import type { UserSettings, VoiceName, VoiceSettings, ToolsMode } from '@/types/settings';
import { DEFAULT_USER_SETTINGS } from '@/types/settings';

const STORAGE_KEY = 'userSettings';

export async function getSettings(): Promise<UserSettings> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = (result?.[STORAGE_KEY] || {}) as Partial<UserSettings>;
    const mergedVoice: VoiceSettings = {
      voiceName: (stored.voice?.voiceName ?? DEFAULT_USER_SETTINGS.voice!.voiceName) as VoiceName,
    };
    const merged: UserSettings = {
      ...DEFAULT_USER_SETTINGS,
      ...stored,
      voice: mergedVoice,
      ttsProvider: stored.ttsProvider ?? DEFAULT_USER_SETTINGS.ttsProvider,
      suggestionsEnabled: stored.suggestionsEnabled ?? DEFAULT_USER_SETTINGS.suggestionsEnabled,
      maxToolCallLimit: stored.maxToolCallLimit ?? DEFAULT_USER_SETTINGS.maxToolCallLimit,
    };
    return merged;
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

export async function saveSettings(next: UserSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
}

export async function updateSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings();
  const next: UserSettings = {
    ...current,
    ...patch,
    voice: {
      voiceName: (patch.voice?.voiceName ?? current.voice?.voiceName ?? DEFAULT_USER_SETTINGS.voice!.voiceName) as VoiceName,
    },
  };
  await saveSettings(next);
  return next;
}

// Enabled tools override helpers
export async function getEnabledToolsOverride(): Promise<string[] | undefined> {
  const settings = await getSettings();
  return settings.enabledToolsOverride;
}

export async function setEnabledToolsOverride(tools: string[] | undefined): Promise<UserSettings> {
  return updateSettings({ enabledToolsOverride: tools });
}

// Voice settings helpers
export async function getVoiceName(): Promise<VoiceName> {
  const settings = await getSettings();
  return settings.voice?.voiceName || DEFAULT_USER_SETTINGS.voice!.voiceName;
}

export async function setVoiceName(voiceName: VoiceName): Promise<UserSettings> {
  return updateSettings({ voice: { voiceName } });
}

// TTS provider helpers
export async function getTTSProvider(): Promise<import('@/types/settings').TTSProvider> {
  const settings = await getSettings();
  return settings.ttsProvider || DEFAULT_USER_SETTINGS.ttsProvider!;
}

export async function setTTSProvider(provider: import('@/types/settings').TTSProvider): Promise<UserSettings> {
  return updateSettings({ ttsProvider: provider });
}

// Suggestions enabled helpers
export async function getSuggestionsEnabled(): Promise<boolean> {
  const settings = await getSettings();
  return settings.suggestionsEnabled ?? DEFAULT_USER_SETTINGS.suggestionsEnabled!;
}

export async function setSuggestionsEnabled(enabled: boolean): Promise<UserSettings> {
  return updateSettings({ suggestionsEnabled: enabled });
}

// Max tool call limit helpers
export async function getMaxToolCallLimit(): Promise<number> {
  const settings = await getSettings();
  return settings.maxToolCallLimit ?? DEFAULT_USER_SETTINGS.maxToolCallLimit!;
}

export async function setMaxToolCallLimit(limit: number): Promise<UserSettings> {
  return updateSettings({ maxToolCallLimit: limit });
}

// Supermemory settings helpers
// Note: These integrate with the dedicated supermemory credential utilities
// in src/utils/supermemory/credentials.ts for actual storage operations.

export async function getSupermemoryApiKey(): Promise<string | undefined> {
  const settings = await getSettings();
  return settings.supermemoryApiKey;
}

export async function setSupermemoryApiKey(apiKey: string | undefined): Promise<UserSettings> {
  return updateSettings({ supermemoryApiKey: apiKey });
}

export async function getSupermemoryEnabled(): Promise<boolean> {
  const settings = await getSettings();
  return settings.supermemoryEnabled ?? DEFAULT_USER_SETTINGS.supermemoryEnabled!;
}

export async function setSupermemoryEnabled(enabled: boolean): Promise<UserSettings> {
  return updateSettings({ supermemoryEnabled: enabled });
}

// Tools mode helpers
export async function getToolsMode(): Promise<ToolsMode> {
  const settings = await getSettings();
  return settings.toolsMode ?? DEFAULT_USER_SETTINGS.toolsMode!;
}

export async function setToolsMode(mode: ToolsMode): Promise<UserSettings> {
  return updateSettings({ toolsMode: mode });
}

export async function setToolsConfig(mode: ToolsMode, tools: string[]): Promise<UserSettings> {
  return updateSettings({
    toolsMode: mode,
    enabledToolsOverride: tools
  });
}

// AI Providers config helpers
// Legacy storage key
const LEGACY_STORAGE_KEY = 'ai_provider_config';

async function migrateLegacyConfig(): Promise<import('@cognito/shared/types').AIProviderConfig | undefined> {
  const result = await chrome.storage.local.get(LEGACY_STORAGE_KEY);
  const legacy = result[LEGACY_STORAGE_KEY] as import('@cognito/shared/types').ProviderConfig | undefined;

  if (!legacy) return undefined;

  const providers: import('@cognito/shared/types').ConfigProvider[] = [];

  if (legacy.googleApiKey) {
    providers.push({
      name: 'google_gemini',
      enabled: legacy.provider === 'google',
      api_key: legacy.googleApiKey,
      models: [
        {
          enabled: true,
          id: 'gemini-1.5-pro',
          name: 'Gemini 1.5 Pro',
          features: {
            function_calling: true,
            structured_output: true,
            reasoning: true,
            web_search: true
          }
        },
        {
          enabled: true,
          id: 'gemini-1.5-flash',
          name: 'Gemini 1.5 Flash',
          features: {
            function_calling: true,
            structured_output: true,
            reasoning: true,
            web_search: true
          }
        }
      ] // Basic default models
    });
  }

  if (legacy.vertexCredentials) {
    providers.push({
      name: 'vertex',
      enabled: legacy.provider === 'vertex',
      custom_fields: legacy.vertexCredentials as unknown as Record<string, string>,
      models: [
        {
          enabled: true,
          id: 'gemini-1.5-pro',
          name: 'Gemini 1.5 Pro',
          features: {
            function_calling: true,
            structured_output: true,
            reasoning: true,
            web_search: true
          }
        }
      ]
    });
  }

  if (providers.length === 0) return undefined;

  const newConfig: import('@cognito/shared/types').AIProviderConfig = {
    providers
  };

  // Save to new storage
  await setProvidersConfig(newConfig);
  return newConfig;
}

export async function getProvidersConfig(): Promise<import('@cognito/shared/types').AIProviderConfig | undefined> {
  const settings = await getSettings();
  if (settings.providersConfig) {
    return settings.providersConfig;
  }

  // Try migration
  return migrateLegacyConfig();
}

export async function setProvidersConfig(config: import('@cognito/shared/types').AIProviderConfig): Promise<UserSettings> {
  return updateSettings({ providersConfig: config });
}


