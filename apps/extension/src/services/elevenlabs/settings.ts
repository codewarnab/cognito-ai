/**
 * ElevenLabs Voice Settings Storage
 * Manages voice preferences and tool settings using wxt/storage
 */


import { createLogger } from '~logger';

const log = createLogger('ElevenLabs-Settings', 'VOICE_CLIENT_STATE');

// Default tools that are enabled
const DEFAULT_ENABLED_TOOLS = [
  'navigateTo',
  'clickByText',
  'typeInField',
  'readPageContent',
  'scrollPage',
  'pressKey',
  'takeScreenshot',
  'getActiveTab',
  'switchTabs',
  'getSearchResults',
  'getYouTubeTranscript',
];

// All available tools with metadata
export interface ToolInfo {
  id: string;
  name: string;
  description: string;
}

export const ALL_TOOLS: ToolInfo[] = [
  { id: 'navigateTo', name: 'Navigate', description: 'Open URLs and navigate pages' },
  { id: 'clickByText', name: 'Click', description: 'Click buttons, links, and text' },
  { id: 'typeInField', name: 'Type', description: 'Type into input fields' },
  { id: 'readPageContent', name: 'Read Page', description: 'Extract page content' },
  { id: 'scrollPage', name: 'Scroll', description: 'Scroll pages up/down' },
  { id: 'pressKey', name: 'Press Key', description: 'Press keyboard keys' },
  { id: 'takeScreenshot', name: 'Screenshot', description: 'Capture screenshots' },
  { id: 'getActiveTab', name: 'Active Tab', description: 'Get current tab info' },
  { id: 'switchTabs', name: 'Switch Tabs', description: 'Switch between tabs' },
  { id: 'getSearchResults', name: 'Search Results', description: 'Parse search results' },
  { id: 'getYouTubeTranscript', name: 'YouTube', description: 'Analyze YouTube videos' },

  { id: 'createReminder', name: 'Create Reminder', description: 'Create reminders' },
  { id: 'listReminders', name: 'List Reminders', description: 'List active reminders' },
  { id: 'cancelReminder', name: 'Cancel Reminder', description: 'Cancel reminders' },
  { id: 'applyTabGroups', name: 'Tab Groups', description: 'Organize tabs into groups' },
];

export interface VoiceSettings {
  stability: number;
  similarityBoost: number;
  speed: number;
}

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.7,
  similarityBoost: 0.9,
  speed: 1.0,
};

// Define storage items using WXT storage API
const voiceIdItem = storage.defineItem<string | null>('local:elevenlabs_voice_id', {
  fallback: null,
});

const enabledToolsItem = storage.defineItem<string[]>('local:elevenlabs_enabled_tools', {
  fallback: DEFAULT_ENABLED_TOOLS,
});

const voiceSettingsItem = storage.defineItem<VoiceSettings>('local:elevenlabs_voice_settings', {
  fallback: DEFAULT_VOICE_SETTINGS,
});

/**
 * Get selected voice ID
 */
export async function getSelectedVoiceId(): Promise<string | null> {
  return await voiceIdItem.getValue();
}

/**
 * Set selected voice ID
 */
export async function setSelectedVoiceId(voiceId: string): Promise<void> {
  await voiceIdItem.setValue(voiceId);
  log.info('Voice ID saved', { voiceId });
}

/**
 * Get enabled tools list
 */
export async function getEnabledTools(): Promise<string[]> {
  return await enabledToolsItem.getValue();
}

/**
 * Set enabled tools list
 */
export async function setEnabledTools(tools: string[]): Promise<void> {
  await enabledToolsItem.setValue(tools);
  log.info('Enabled tools saved', { count: tools.length });
}

/**
 * Get voice settings (stability, similarity, speed)
 */
export async function getVoiceSettings(): Promise<VoiceSettings> {
  return await voiceSettingsItem.getValue();
}

/**
 * Set voice settings
 */
export async function setVoiceSettings(settings: VoiceSettings): Promise<void> {
  await voiceSettingsItem.setValue(settings);
  log.info('Voice settings saved');
}
