/**
 * Chrome Storage Logger Adapter
 *
 * Implementation of LoggerStorageAdapter for Chrome extension storage.
 * Uses chrome.storage.local for persistence with cross-context sync.
 *
 * Features:
 * - Persists config to chrome.storage.local (survives extension updates)
 * - Syncs across all extension contexts (background, sidepanel, content scripts)
 * - Falls back to DEVELOPMENT preset if storage is empty/invalid
 *
 * @see {@link LoggerStorageAdapter} for interface documentation
 */
import type { LoggerStorageAdapter } from '@cognito/shared';
import type { LoggerConfig } from '@cognito/shared';
import { LOG_PRESETS, LOGGER_CONFIG_KEY } from '@cognito/shared';

/**
 * Chrome storage-based logger configuration adapter for the extension.
 *
 * @example
 * ```ts
 * const adapter = new ChromeStorageLoggerAdapter();
 * const config = await adapter.getConfig();
 *
 * // Update config
 * await adapter.setConfig({ ...config, AI_CHAT: true });
 *
 * // Listen for changes from other contexts
 * const cleanup = adapter.onConfigChange((newConfig) => {
 *   console.log('Config changed:', newConfig);
 * });
 * ```
 */
export class ChromeStorageLoggerAdapter implements LoggerStorageAdapter {
    /**
     * Retrieve the current logger configuration from chrome.storage.local.
     * Merges stored config with DEVELOPMENT preset to ensure all categories exist.
     *
     * @returns Promise resolving to the current logger configuration
     */
    async getConfig(): Promise<LoggerConfig> {
        try {
            const result = await chrome.storage.local.get(LOGGER_CONFIG_KEY);
            const stored = result?.[LOGGER_CONFIG_KEY] as LoggerConfig | undefined;

            if (stored) {
                // Merge with default to ensure all categories exist
                return {
                    ...LOG_PRESETS.DEVELOPMENT,
                    ...stored,
                };
            }
        } catch (error) {
            console.warn('[ChromeStorageLoggerAdapter] Failed to get config:', error);
        }

        return { ...LOG_PRESETS.DEVELOPMENT };
    }

    /**
     * Save the entire logger configuration to chrome.storage.local.
     *
     * @param config - The complete logger configuration to persist
     */
    async setConfig(config: LoggerConfig): Promise<void> {
        try {
            await chrome.storage.local.set({ [LOGGER_CONFIG_KEY]: config });
        } catch (error) {
            console.error('[ChromeStorageLoggerAdapter] Failed to save config:', error);
            throw error;
        }
    }

    /**
     * Subscribe to configuration changes from other extension contexts.
     * Uses chrome.storage.onChanged for cross-context sync.
     *
     * @param callback - Function called when config changes
     * @returns Cleanup function to unsubscribe
     */
    onConfigChange(callback: (config: LoggerConfig) => void): () => void {
        const handler = (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: string
        ) => {
            if (areaName === 'local' && changes[LOGGER_CONFIG_KEY]) {
                const newConfig = changes[LOGGER_CONFIG_KEY].newValue as LoggerConfig | undefined;
                if (newConfig) {
                    callback(newConfig);
                }
            }
        };

        chrome.storage.onChanged.addListener(handler);

        // Return cleanup function
        return () => {
            chrome.storage.onChanged.removeListener(handler);
        };
    }
}

/**
 * Singleton instance for use throughout the extension.
 * Prefer using this over creating new instances.
 */
export const chromeStorageLoggerAdapter = new ChromeStorageLoggerAdapter();
