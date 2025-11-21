/**
 * Settings storage utilities for user-configurable preferences
 */
import type { UserSettings, VoiceName, VoiceSettings } from '../types/settings';
import { DEFAULT_USER_SETTINGS } from '../types/settings';

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


