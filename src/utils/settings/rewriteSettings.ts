/**
 * Rewrite Settings
 * Settings storage for the text rewrite feature
 */
import { createLogger } from '~logger';
import type { RewritePreset } from '@/types';

const log = createLogger('RewriteSettings', 'STORAGE');

export const REWRITE_STORAGE_KEY = 'rewriteSettings';

export interface RewriteSettings {
    /** Whether the rewrite feature is enabled */
    enabled: boolean;
    /** Whether to show preset buttons in the tooltip */
    showPresets: boolean;
    /** Default preset to use (null = show all options) */
    defaultPreset: RewritePreset | null;
    /** Minimum text length to trigger rewrite tooltip */
    minSelectionLength: number;
    // Gemini Tool settings
    /** Enable URL fetching/analysis tool */
    enableUrlContext: boolean;
    /** Enable Google Search grounding tool */
    enableGoogleSearch: boolean;
}

export const DEFAULT_REWRITE_SETTINGS: RewriteSettings = {
    enabled: true,
    showPresets: true,
    defaultPreset: null,
    minSelectionLength: 10,
    enableUrlContext: false,
    enableGoogleSearch: false,
};

/**
 * Get the current rewrite settings from storage
 */
export async function getRewriteSettings(): Promise<RewriteSettings> {
    try {
        const result = await chrome.storage.local.get(REWRITE_STORAGE_KEY);
        return { ...DEFAULT_REWRITE_SETTINGS, ...(result[REWRITE_STORAGE_KEY] || {}) };
    } catch (error) {
        log.error('Failed to get settings:', error);
        return DEFAULT_REWRITE_SETTINGS;
    }
}

/**
 * Save rewrite settings to storage
 */
export async function saveRewriteSettings(settings: RewriteSettings): Promise<void> {
    try {
        await chrome.storage.local.set({ [REWRITE_STORAGE_KEY]: settings });
        log.info('Settings saved');
    } catch (error) {
        log.error('Failed to save settings:', error);
        throw error;
    }
}

/**
 * Check if the rewrite feature is enabled
 */
export async function isRewriteEnabled(): Promise<boolean> {
    const settings = await getRewriteSettings();
    return settings.enabled;
}

/**
 * Update a specific rewrite setting
 */
export async function updateRewriteSetting<K extends keyof RewriteSettings>(
    key: K,
    value: RewriteSettings[K]
): Promise<RewriteSettings> {
    const current = await getRewriteSettings();
    const updated = { ...current, [key]: value };
    await saveRewriteSettings(updated);
    return updated;
}
