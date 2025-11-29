/**
 * Settings types for user-configurable preferences
 */

export type VoiceName = 'Aoede' | 'Orus' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Orion';

export type TTSProvider = 'gemini' | 'web-native';

/**
 * Tools mode determines which system prompt and tool set to use.
 * - 'chat': Minimal tools, focused on reading and Q&A (simpler system prompt)
 * - 'agent': Full browser automation capabilities (full system prompt)
 * - 'custom': User has customized the tool selection
 */
export type ToolsMode = 'chat' | 'agent' | 'custom';

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
  ttsProvider?: TTSProvider;
  suggestionsEnabled?: boolean;
  /**
   * Maximum number of tool calls (steps) the AI can make in a single response.
   * Default is 20. Higher values allow more complex multi-step operations but may increase response time.
   */
  maxToolCallLimit?: number;
  /**
   * Supermemory API key for cloud-based memory persistence.
   * Stored separately in chrome.storage.local for security.
   */
  supermemoryApiKey?: string;
  /**
   * Whether Supermemory is enabled for persistent memory across conversations.
   * Requires a valid API key to function.
   */
  supermemoryEnabled?: boolean;
  /**
   * Current tools mode selection.
   * Determines system prompt and available tools.
   */
  toolsMode?: ToolsMode;
  /**
   * Whether to automatically extract facts from conversations and save to Supermemory.
   * Requires Supermemory to be enabled and configured.
   */
  autoMemoryExtraction?: boolean;
  /**
   * Minimum number of messages required before auto-extraction triggers.
   * Default: 4 (at least 2 user + 2 assistant messages)
   */
  autoMemoryMinMessages?: number;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  version: 1,
  enabledToolsOverride: undefined,
  voice: {
    voiceName: 'Aoede',
  },
  ttsProvider: 'gemini',
  suggestionsEnabled: true,
  maxToolCallLimit: 20,
  supermemoryApiKey: undefined,
  supermemoryEnabled: false,
  toolsMode: 'agent',
  autoMemoryExtraction: false,
  autoMemoryMinMessages: 4,
};


