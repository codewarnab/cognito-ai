/**
 * Text Summarizer Settings
 * Settings storage for the text selection summarizer feature
 */
import { createLogger } from '~logger';

const log = createLogger('TextSummarizerSettings', 'STORAGE');

export const TEXT_SUMMARIZER_STORAGE_KEY = 'textSummarizerSettings';

export interface TextSummarizerSettings {
    enabled: boolean;
    minTextLength: number;
    summaryType: 'key-points' | 'tl-dr' | 'headline' | 'teaser';
    summaryLength: 'short' | 'medium' | 'long';
}

export const DEFAULT_SUMMARIZER_SETTINGS: TextSummarizerSettings = {
    enabled: true,
    minTextLength: 100,
    summaryType: 'tl-dr',
    summaryLength: 'medium',
};

/**
 * Get the current text summarizer settings from storage
 */
export async function getTextSummarizerSettings(): Promise<TextSummarizerSettings> {
    try {
        const result = await chrome.storage.local.get(TEXT_SUMMARIZER_STORAGE_KEY);
        return { ...DEFAULT_SUMMARIZER_SETTINGS, ...(result[TEXT_SUMMARIZER_STORAGE_KEY] || {}) };
    } catch (error) {
        log.error('Failed to get settings:', error);
        return DEFAULT_SUMMARIZER_SETTINGS;
    }
}

/**
 * Save text summarizer settings to storage
 */
export async function saveTextSummarizerSettings(settings: TextSummarizerSettings): Promise<void> {
    try {
        await chrome.storage.local.set({ [TEXT_SUMMARIZER_STORAGE_KEY]: settings });
        log.info('Settings saved');
    } catch (error) {
        log.error('Failed to save settings:', error);
        throw error;
    }
}

/**
 * Check if the text summarizer feature is enabled
 */
export async function isTextSummarizerEnabled(): Promise<boolean> {
    const settings = await getTextSummarizerSettings();
    return settings.enabled;
}

/**
 * Get the minimum text length required to show the summarize button
 */
export async function getMinTextLength(): Promise<number> {
    const settings = await getTextSummarizerSettings();
    return settings.minTextLength;
}

/**
 * Update a specific setting
 */
export async function updateTextSummarizerSetting<K extends keyof TextSummarizerSettings>(
    key: K,
    value: TextSummarizerSettings[K]
): Promise<TextSummarizerSettings> {
    const current = await getTextSummarizerSettings();
    const updated = { ...current, [key]: value };
    await saveTextSummarizerSettings(updated);
    return updated;
}
