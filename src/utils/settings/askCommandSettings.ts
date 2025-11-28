/**
 * Ask Command Settings
 * Settings storage for the /ask slash command feature
 */
import { createLogger } from '~logger';

const log = createLogger('AskCommandSettings', 'STORAGE');

export const ASK_COMMAND_STORAGE_KEY = 'askCommandSettings';

export interface AskCommandSettings {
    enabled: boolean;
    includePageContext: boolean;
    includeSelectedText: boolean;
    includeVisibleContent: boolean;
    maxOutputTokens: number;
    // Gemini Tool settings
    enableUrlContext: boolean;
    enableGoogleSearch: boolean;
    // Supermemory integration
    enableSupermemorySearch: boolean;
}

export const DEFAULT_ASK_SETTINGS: AskCommandSettings = {
    enabled: true,
    includePageContext: true,
    includeSelectedText: true,
    includeVisibleContent: true,
    maxOutputTokens: 2048, // Higher default for Q&A
    enableUrlContext: false,
    enableGoogleSearch: false,
    enableSupermemorySearch: false,
};

/**
 * Get the current ask command settings from storage
 */
export async function getAskCommandSettings(): Promise<AskCommandSettings> {
    try {
        const result = await chrome.storage.local.get(ASK_COMMAND_STORAGE_KEY);
        return { ...DEFAULT_ASK_SETTINGS, ...(result[ASK_COMMAND_STORAGE_KEY] || {}) };
    } catch (error) {
        log.error('Failed to get settings:', error);
        return DEFAULT_ASK_SETTINGS;
    }
}

/**
 * Save ask command settings to storage
 */
export async function saveAskCommandSettings(settings: AskCommandSettings): Promise<void> {
    try {
        await chrome.storage.local.set({ [ASK_COMMAND_STORAGE_KEY]: settings });
        log.info('Settings saved');
    } catch (error) {
        log.error('Failed to save settings:', error);
        throw error;
    }
}

/**
 * Check if the ask command feature is enabled
 */
export async function isAskCommandEnabled(): Promise<boolean> {
    const settings = await getAskCommandSettings();
    return settings.enabled;
}

/**
 * Update a specific ask command setting
 */
export async function updateAskCommandSetting<K extends keyof AskCommandSettings>(
    key: K,
    value: AskCommandSettings[K]
): Promise<AskCommandSettings> {
    const current = await getAskCommandSettings();
    const updated = { ...current, [key]: value };
    await saveAskCommandSettings(updated);
    return updated;
}
