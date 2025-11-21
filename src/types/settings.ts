/**
 * Settings types for user-configurable preferences
 */

export type VoiceName = 'Aoede' | 'Orus' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Orion';

export interface VoiceSettings {
  voiceName: VoiceName;
}

export interface UserSettings {
  version: number;
  /**
   * When defined, this list represents the user-selected enabled tools.
   * When undefined, the app should fall back to defaults.
   */
  enabledToolsOverride?: string[];
  voice?: VoiceSettings;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  version: 1,
  enabledToolsOverride: undefined,
  voice: {
    voiceName: 'Aoede',
  },
};


