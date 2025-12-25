/**
 * useExtensionLoggerSync Hook
 *
 * Provides functionality to sync logger configuration from webapp to extension.
 * Uses Chrome runtime messaging API for communication.
 *
 * @example
 * ```tsx
 * function LoggerPanel() {
 *   const { isExtensionConnected, syncToExtension } = useExtensionLoggerSync();
 *
 *   return (
 *     <div>
 *       {isExtensionConnected ? 'Connected' : 'Not connected'}
 *       <button onClick={() => syncToExtension(config)}>Sync</button>
 *     </div>
 *   );
 * }
 * ```
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LoggerConfig, LoggerConfigResponse } from '@cognito/shared';
import { extensionAPI } from '@/lib/extension-api';

/**
 * Return type for useExtensionLoggerSync hook
 */
interface UseExtensionLoggerSyncReturn {
    /** Whether the extension is installed and responding */
    isExtensionConnected: boolean;
    /** Sync logger config to extension, returns true on success */
    syncToExtension: (config: LoggerConfig) => Promise<boolean>;
    /** Get current logger config from extension */
    getExtensionConfig: () => Promise<LoggerConfig | null>;
}

/**
 * Hook to sync logger configuration with the Chrome extension.
 *
 * Features:
 * - Checks extension connection on mount
 * - Provides function to push config updates to extension
 * - Provides function to fetch current config from extension
 */
export function useExtensionLoggerSync(): UseExtensionLoggerSyncReturn {
    const [isExtensionConnected, setIsExtensionConnected] = useState(false);

    // Check if extension is installed and connectable on mount
    useEffect(() => {
        async function checkConnection() {
            try {
                const response = await extensionAPI.getLoggerConfig();
                setIsExtensionConnected(response.success);
            } catch {
                setIsExtensionConnected(false);
            }
        }

        checkConnection();
    }, []);

    /**
     * Send config update to extension
     */
    const syncToExtension = useCallback(
        async (config: LoggerConfig): Promise<boolean> => {
            if (!isExtensionConnected) {
                return false;
            }

            try {
                const response = await extensionAPI.updateLoggerConfig(config);
                if (response.success) {
                    console.log('[ExtensionLoggerSync] Config synced to extension');
                }
                return response.success;
            } catch (error) {
                console.warn('[ExtensionLoggerSync] Failed to sync config:', error);
                return false;
            }
        },
        [isExtensionConnected]
    );

    /**
     * Get current config from extension
     */
    const getExtensionConfig = useCallback(async (): Promise<LoggerConfig | null> => {
        if (!isExtensionConnected) {
            return null;
        }

        try {
            const response = await extensionAPI.getLoggerConfig();
            if (response.success && response.data) {
                return (response.data as LoggerConfigResponse).config;
            }
            return null;
        } catch {
            return null;
        }
    }, [isExtensionConnected]);

    return {
        isExtensionConnected,
        syncToExtension,
        getExtensionConfig,
    };
}
