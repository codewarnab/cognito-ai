/**
 * Write Command Settings
 * Settings storage for the /write slash command feature
 */
import { createLogger } from '~logger';

const log = createLogger('WriteCommandSettings', 'STORAGE');

export const WRITE_COMMAND_STORAGE_KEY = 'writeCommandSettings';

export interface WriteCommandSettings {
    enabled: boolean;
    defaultTone: 'professional' | 'casual' | 'formal' | 'friendly';
    includePageContext: boolean;
    maxOutputTokens: number;
    // Gemini Tool settings
    enableUrlContext: boolean;    // Enable URL fetching/analysis tool
    enableGoogleSearch: boolean;  // Enable Google Search grounding tool
    // Supermemory integration
    enableSupermemorySearch: boolean;  // Enable Supermemory semantic search
}

export const DEFAULT_WRITE_SETTINGS: WriteCommandSettings = {
    enabled: true,
    defaultTone: 'professional',
    includePageContext: true,
    maxOutputTokens: 1024,
    enableUrlContext: false,
    enableGoogleSearch: false,
    enableSupermemorySearch: false,
};

/**
 * Get the current write command settings from storage
 */
export async function getWriteCommandSettings(): Promise<WriteCommandSettings> {
    try {
        const result = await chrome.storage.local.get(WRITE_COMMAND_STORAGE_KEY);
        return { ...DEFAULT_WRITE_SETTINGS, ...(result[WRITE_COMMAND_STORAGE_KEY] || {}) };
    } catch (error) {
        log.error('Failed to get settings:', error);
        return DEFAULT_WRITE_SETTINGS;
    }
}

/**
 * Save write command settings to storage
 */
export async function saveWriteCommandSettings(settings: WriteCommandSettings): Promise<void> {
    try {
        await chrome.storage.local.set({ [WRITE_COMMAND_STORAGE_KEY]: settings });
        log.info('Settings saved');
    } catch (error) {
        log.error('Failed to save settings:', error);
        throw error;
    }
}

/**
 * Check if the write command feature is enabled
 */
export async function isWriteCommandEnabled(): Promise<boolean> {
    const settings = await getWriteCommandSettings();
    return settings.enabled;
}

/**
 * Update a specific write command setting
 */
export async function updateWriteCommandSetting<K extends keyof WriteCommandSettings>(
    key: K,
    value: WriteCommandSettings[K]
): Promise<WriteCommandSettings> {
    const current = await getWriteCommandSettings();
    const updated = { ...current, [key]: value };
    await saveWriteCommandSettings(updated);
    return updated;
}
