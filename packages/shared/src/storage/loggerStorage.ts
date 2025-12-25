/**
 * Logger Storage Abstraction
 *
 * Provides a common interface for storing and retrieving logger configuration
 * across different environments (Chrome extension, webapp).
 *
 * - Extension uses chrome.storage.local
 * - Webapp uses localStorage
 *
 * This abstraction enables the Logger Panel to work in both environments
 * without coupling to platform-specific storage APIs.
 */
import type { LoggerConfig } from '../types/logger.js';

/**
 * Storage adapter interface for logger configuration.
 * Implementations must handle their platform-specific storage mechanism.
 */
export interface LoggerStorageAdapter {
    /**
     * Retrieve the current logger configuration from storage.
     * Should merge with default (DEVELOPMENT preset) to ensure all categories exist.
     * @returns The current logger configuration
     */
    getConfig(): Promise<LoggerConfig>;

    /**
     * Save the entire logger configuration to storage.
     * @param config - The complete logger configuration to persist
     */
    setConfig(config: LoggerConfig): Promise<void>;

    /**
     * Subscribe to configuration changes from other contexts.
     * Used for cross-tab/cross-context synchronization.
     *
     * @param callback - Function called when config changes externally
     * @returns Cleanup function to unsubscribe
     */
    onConfigChange(callback: (config: LoggerConfig) => void): () => void;
}

/**
 * Helper type for storage change events (used by adapters)
 */
export interface LoggerStorageChangeEvent {
    oldValue?: LoggerConfig;
    newValue?: LoggerConfig;
}
