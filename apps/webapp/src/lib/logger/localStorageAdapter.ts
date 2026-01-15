/**
 * LocalStorage Logger Adapter
 *
 * Implementation of LoggerStorageAdapter for browser localStorage.
 * Used by the webapp Logger Panel for persisting logger configuration.
 *
 * Features:
 * - Persists config to localStorage for cross-session persistence
 * - In-memory caching to avoid repeated localStorage reads
 * - Cache invalidation on storage events and visibility changes
 * - Fires StorageEvents for cross-tab synchronization
 * - Falls back to DEVELOPMENT preset if storage is empty/invalid
 *
 * @see {@link LoggerStorageAdapter} for interface documentation
 */
import type { LoggerStorageAdapter, LoggerConfig } from '@cognito/shared';
import { LOG_PRESETS, LOGGER_CONFIG_KEY } from '@cognito/shared';

/**
 * In-memory cache for logger config
 * - null means cache is uninitialized or invalidated
 */
let configCache: LoggerConfig | null = null;

/**
 * Track if event listeners have been registered
 */
let cacheListenersRegistered = false;

/**
 * Invalidate the config cache
 */
function invalidateConfigCache(): void {
    configCache = null;
}

/**
 * Register event listeners for cache invalidation (singleton pattern)
 */
function ensureCacheListenersRegistered(): void {
    if (cacheListenersRegistered) return;
    if (typeof window === 'undefined') return;

    // Invalidate cache when other tabs modify localStorage
    window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === LOGGER_CONFIG_KEY || event.key === null) {
            invalidateConfigCache();
        }
    });

    // Invalidate cache when tab becomes visible (may have been modified while hidden)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            invalidateConfigCache();
        }
    });

    cacheListenersRegistered = true;
}

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
     * Uses in-memory caching to avoid repeated localStorage reads.
     * Merges stored config with DEVELOPMENT preset to ensure all categories exist.
     *
     * @returns Promise resolving to the current logger configuration
     */
    async getConfig(): Promise<LoggerConfig> {
        // Ensure listeners are set up
        ensureCacheListenersRegistered();

        // Return cached value if available
        if (configCache !== null) {
            return configCache;
        }

        try {
            // Check if localStorage is available (SSR safety)
            if (typeof window === 'undefined' || !window.localStorage) {
                return { ...LOG_PRESETS.DEVELOPMENT };
            }

            const stored = localStorage.getItem(LOGGER_CONFIG_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as Partial<LoggerConfig>;
                // Merge with default to ensure all categories exist
                const config = {
                    ...LOG_PRESETS.DEVELOPMENT,
                    ...parsed,
                };
                // Update cache
                configCache = config;
                return config;
            }
        } catch (error) {
            console.warn('[LocalStorageLoggerAdapter] Failed to parse stored config:', error);
        }

        const defaultConfig = { ...LOG_PRESETS.DEVELOPMENT };
        configCache = defaultConfig;
        return defaultConfig;
    }

    /**
     * Save the entire logger configuration to localStorage.
     * Updates the in-memory cache immediately (write-through).
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

            // Update cache immediately (write-through)
            configCache = { ...config };

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
     * Also invalidates cache on config changes to ensure consistency.
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
                    // Invalidate cache since external change occurred
                    invalidateConfigCache();
                    callback(config);
                } catch (error) {
                    console.warn('[LocalStorageLoggerAdapter] Failed to parse storage event:', error);
                }
            }
        };

        // Handler for same-tab changes (CustomEvent)
        const customHandler = (event: Event) => {
            const customEvent = event as CustomEvent<{ config: LoggerConfig }>;
            // Cache is already updated via write-through in setConfig
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
