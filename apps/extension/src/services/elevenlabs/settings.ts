/**
 * ElevenLabs Voice Settings Storage
 * Manages voice preferences and tool settings using @plasmohq/storage
 */

import { Storage } from '@plasmohq/storage';
import { createLogger } from '~logger';

const log = createLogger('ElevenLabs-Settings');
const storage = new Storage({ area: 'local' });

const STORAGE_KEYS = {
  SELECTED_VOICE_ID: 'elevenlabs_voice_id',
  ENABLED_TOOLS: 'elevenlabs_enabled_tools',
  VOICE_SETTINGS: 'elevenlabs_voice_settings',
} as const;

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
  { id: 'searchHistory', name: 'History', description: 'Search browsing history' },
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

/**
 * Get selected voice ID
 */
export async function getSelectedVoiceId(): Promise<string | null> {
  try {
    const voiceId = await storage.get<string>(STORAGE_KEYS.SELECTED_VOICE_ID);
    return voiceId || null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Failed to get selected voice ID', { error: errorMessage });
    return null;
  }
}

/**
 * Set selected voice ID
 */
export async function setSelectedVoiceId(voiceId: string): Promise<void> {
  try {
    await storage.set(STORAGE_KEYS.SELECTED_VOICE_ID, voiceId);
    log.info('Voice ID saved', { voiceId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Failed to save voice ID', { error: errorMessage });
    throw new Error(`Failed to save voice ID: ${errorMessage}`);
  }
}

/**
 * Get enabled tools list
 */
export async function getEnabledTools(): Promise<string[]> {
  try {
    const tools = await storage.get<string[]>(STORAGE_KEYS.ENABLED_TOOLS);
    return tools || DEFAULT_ENABLED_TOOLS;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Failed to get enabled tools', { error: errorMessage });
    return DEFAULT_ENABLED_TOOLS;
  }
}

/**
 * Set enabled tools list
 */
export async function setEnabledTools(tools: string[]): Promise<void> {
  try {
    await storage.set(STORAGE_KEYS.ENABLED_TOOLS, tools);
    log.info('Enabled tools saved', { count: tools.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Failed to save enabled tools', { error: errorMessage });
    throw new Error(`Failed to save enabled tools: ${errorMessage}`);
  }
}

/**
 * Get voice settings (stability, similarity, speed)
 */
export async function getVoiceSettings(): Promise<VoiceSettings> {
  try {
    const settings = await storage.get<VoiceSettings>(STORAGE_KEYS.VOICE_SETTINGS);
    return settings || DEFAULT_VOICE_SETTINGS;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Failed to get voice settings', { error: errorMessage });
    return DEFAULT_VOICE_SETTINGS;
  }
}

/**
 * Set voice settings
 */
export async function setVoiceSettings(settings: VoiceSettings): Promise<void> {
  try {
    await storage.set(STORAGE_KEYS.VOICE_SETTINGS, settings);
    log.info('Voice settings saved');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Failed to save voice settings', { error: errorMessage });
    throw new Error(`Failed to save voice settings: ${errorMessage}`);
  }
}
