/**
 * LocalStorage Logger Adapter
 *
 * Implementation of LoggerStorageAdapter for browser localStorage.
 * Used by the webapp Logger Panel for persisting logger configuration.
 *
 * Features:
 * - Persists config to localStorage for cross-session persistence
 * - Fires StorageEvents for cross-tab synchronization
 * - Falls back to DEVELOPMENT preset if storage is empty/invalid
 *
 * @see {@link LoggerStorageAdapter} for interface documentation
 */
import type { LoggerStorageAdapter, LoggerConfig } from '@cognito/shared';
import { LOG_PRESETS, LOGGER_CONFIG_KEY } from '@cognito/shared';

/**
 * LocalStorage-based logger configuration adapter for the webapp.
 *
 * @example
 * ```ts
 * const adapter = new LocalStorageLoggerAdapter();
 * const config = await adapter.getConfig();
 *
 * // Update config
 * await adapter.setConfig({ ...config, AI_CHAT: true });
 *
 * // Listen for changes from other tabs
 * const cleanup = adapter.onConfigChange((newConfig) => {
 *   console.log('Config changed:', newConfig);
 * });
 * ```
 */
export class LocalStorageLoggerAdapter implements LoggerStorageAdapter {
    /**
     * Retrieve the current logger configuration from localStorage.
     * Merges stored config with DEVELOPMENT preset to ensure all categories exist.
     *
     * @returns Promise resolving to the current logger configuration
     */
    async getConfig(): Promise<LoggerConfig> {
        try {
            // Check if localStorage is available (SSR safety)
            if (typeof window === 'undefined' || !window.localStorage) {
                return { ...LOG_PRESETS.DEVELOPMENT };
            }

            const stored = localStorage.getItem(LOGGER_CONFIG_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as Partial<LoggerConfig>;
                // Merge with default to ensure all categories exist
                return {
                    ...LOG_PRESETS.DEVELOPMENT,
                    ...parsed,
                };
            }
        } catch (error) {
            console.warn('[LocalStorageLoggerAdapter] Failed to parse stored config:', error);
        }

        return { ...LOG_PRESETS.DEVELOPMENT };
    }

    /**
     * Save the entire logger configuration to localStorage.
     * Dispatches a custom event for same-tab reactivity and relies on
     * StorageEvent for cross-tab sync.
     *
     * @param config - The complete logger configuration to persist
     */
    async setConfig(config: LoggerConfig): Promise<void> {
        // SSR safety check
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }

        try {
            const serialized = JSON.stringify(config);
            localStorage.setItem(LOGGER_CONFIG_KEY, serialized);

            // Dispatch custom event for same-tab reactivity
            // (StorageEvent only fires for OTHER tabs/windows)
            window.dispatchEvent(
                new CustomEvent('logger-config-change', {
                    detail: { config },
                })
            );
        } catch (error) {
            console.error('[LocalStorageLoggerAdapter] Failed to save config:', error);
            throw error;
        }
    }

    /**
     * Subscribe to configuration changes from other contexts.
     * Listens to both:
     * - StorageEvent (cross-tab changes)
     * - Custom 'logger-config-change' event (same-tab changes)
     *
     * @param callback - Function called when config changes
     * @returns Cleanup function to unsubscribe
     */
    onConfigChange(callback: (config: LoggerConfig) => void): () => void {
        // SSR safety check
        if (typeof window === 'undefined') {
            return () => { };
        }

        // Handler for cross-tab changes (StorageEvent)
        const storageHandler = (event: StorageEvent) => {
            if (event.key === LOGGER_CONFIG_KEY && event.newValue) {
                try {
                    const config = JSON.parse(event.newValue) as LoggerConfig;
                    callback(config);
                } catch (error) {
                    console.warn('[LocalStorageLoggerAdapter] Failed to parse storage event:', error);
                }
            }
        };

        // Handler for same-tab changes (CustomEvent)
        const customHandler = (event: Event) => {
            const customEvent = event as CustomEvent<{ config: LoggerConfig }>;
            callback(customEvent.detail.config);
        };

        window.addEventListener('storage', storageHandler);
        window.addEventListener('logger-config-change', customHandler);

        // Return cleanup function
        return () => {
            window.removeEventListener('storage', storageHandler);
            window.removeEventListener('logger-config-change', customHandler);
        };
    }
}

/**
 * Singleton instance for use throughout the webapp.
 * Prefer using this over creating new instances.
 */
export const localStorageLoggerAdapter = new LocalStorageLoggerAdapter();
