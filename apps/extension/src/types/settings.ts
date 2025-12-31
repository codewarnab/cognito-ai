/**
 * Settings types for user - configurable preferences
 */
import type { AIProviderConfig, TTSProvider, VoiceSettings } from '@cognito/shared/types';

export type { TTSProvider, VoiceName, VoiceSettings } from '@cognito/shared/types';

/**
 * ## Mode Taxonomy in the Extension
 * 
 * The extension uses 4 distinct "mode" concepts:
 * 
 * | Type | Values | Purpose | Store |
 * | ------| --------| ---------| -------|
 * | `AIProviderMode` | local / remote | Where AI inference runs | `useModelStore.mode` |
 * | `ToolsMode` | chat / agent / adaptive / custom | Which tools available | `useToolsStore.currentMode` |
 * | `ChatMode` | text / voice | User input method | `useUINavigationStore.chatMode` |
 * | Backend Mode | true / false | Use hosted Vercel API | `useSettingsStore.useBackendMode` |
 * 
 * ## How Modes Interact
 * 
 * - ** AIProviderMode ** + ** Backend Mode **: When remote, useBackendMode determines API routing
 * - ** ToolsMode **: Independent - controls tool availability regardless of provider
 * - ** ChatMode **: Independent - controls input method(text vs voice)
 * 
 * @see `@/components/features/chat/types.ts` for detailed mode documentation
 * @see `@/stores/tools/types.ts` for ToolMode alias
 */



/**
 * ToolsMode - determines which system prompt and tool set to use
 * 
 * This is different from AIProviderMode (where AI runs) and ChatMode (input method).
 * 
 * **Values:**
 * - `chat`: Minimal tools, focused on reading and Q&A (simpler system prompt)
 * - `agent`: Full browser automation capabilities (full system prompt)
 * - `adaptive`: On-demand tool discovery via `discoverTools` + `executeTools` meta-tools
 * - `custom`: User has customized the tool selection manually
 * - `code`: Local CLI agent mode (requires local bridge, no browser tools)
 * 
 * **Related constants:**
 * - `CHAT_MODE_TOOLS` - tools enabled in chat mode
 * - `AGENT_MODE_TOOLS` - tools enabled in agent mode
 * - `ADAPTIVE_MODE_TOOLS` - tools enabled in adaptive mode (discoverTools, executeTools + basics)
 * - `CODE_MODE_TOOLS` - tools enabled in code mode (none - uses local CLI agent)
 */
export type ToolsMode = 'chat' | 'agent' | 'adaptive' | 'custom' | 'code';


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
  /**
   * Configuration for AI providers (Google, OpenAI, Anthropic, etc.)
   * Stores API keys and model preferences.
   */
  providersConfig?: AIProviderConfig;
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
  providersConfig: undefined,
};
