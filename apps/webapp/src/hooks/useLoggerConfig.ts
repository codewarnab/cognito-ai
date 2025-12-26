/**
 * useLoggerConfig Hook
 *
 * React hook for managing logger configuration with localStorage persistence.
 * Provides real-time sync across browser tabs via StorageEvent.
 *
 * This is the webapp equivalent of the extension's useLoggerConfig hook,
 * using localStorage instead of Chrome storage.
 *
 * @example
 * ```tsx
 * function LoggerSettings() {
 *   const { config, isLoading, setCategory, setPreset, isPresetActive, reset } = useLoggerConfig();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <button onClick={() => setPreset('DEBUG_MCP')}>Debug MCP</button>
 *       <Toggle
 *         checked={config?.AI_CHAT}
 *         onChange={(enabled) => setCategory('AI_CHAT', enabled)}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LogCategory, LoggerConfig, LoggerPresetName } from '@cognito/shared';
import { LOG_PRESETS, matchesPreset } from '@cognito/shared';
import { localStorageLoggerAdapter } from '@/lib/logger';

/**
 * Return type for useLoggerConfig hook
 */
interface UseLoggerConfigReturn {
    /** Current logger configuration, null while loading */
    config: LoggerConfig | null;
    /** Whether the config is still loading from storage */
    isLoading: boolean;
    /** Set a single category's enabled state */
    setCategory: (category: LogCategory, enabled: boolean) => Promise<void>;
    /** Apply a preset configuration */
    setPreset: (presetName: LoggerPresetName) => Promise<void>;
    /** Check if current config matches a preset */
    isPresetActive: (presetName: LoggerPresetName) => boolean;
    /** Reset to default (DEVELOPMENT) configuration */
    reset: () => Promise<void>;
}

/**
 * Hook to manage logger configuration with localStorage persistence
 *
 * Features:
 * - Loads config from localStorage on mount
 * - Syncs changes across browser tabs via StorageEvent
 * - Provides preset management and category toggles
 * - Falls back to DEVELOPMENT preset if storage is empty
 */
export function useLoggerConfig(): UseLoggerConfigReturn {
    const [config, setConfig] = useState<LoggerConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load initial config from localStorage
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const loaded = await localStorageLoggerAdapter.getConfig();
                setConfig(loaded);
            } catch (error) {
                console.error('[useLoggerConfig] Failed to load config:', error);
                // Fall back to default config on error
                setConfig({ ...LOG_PRESETS.DEVELOPMENT });
            } finally {
                setIsLoading(false);
            }
        };

        loadConfig();
    }, []);

    // Subscribe to storage changes (cross-tab and same-tab sync)
    useEffect(() => {
        const unsubscribe = localStorageLoggerAdapter.onConfigChange((newConfig) => {
            setConfig(newConfig);
        });

        return unsubscribe;
    }, []);

    /**
     * Update a single log category's enabled state
     */
    const setCategory = useCallback(
        async (category: LogCategory, enabled: boolean) => {
            if (!config) {
                console.warn('[useLoggerConfig] Cannot set category before config is loaded');
                return;
            }

            try {
                const updated: LoggerConfig = {
                    ...config,
                    [category]: enabled,
                };
                await localStorageLoggerAdapter.setConfig(updated);
                // Note: setConfig will be called by the onConfigChange listener
            } catch (error) {
                console.error('[useLoggerConfig] Failed to update category:', error);
                throw error;
            }
        },
        [config]
    );

    /**
     * Apply a preset configuration
     */
    const setPreset = useCallback(async (presetName: LoggerPresetName) => {
        const preset = LOG_PRESETS[presetName];
        if (!preset) {
            console.error('[useLoggerConfig] Unknown preset:', presetName);
            return;
        }

        try {
            await localStorageLoggerAdapter.setConfig({ ...preset });
            // Note: setConfig will be called by the onConfigChange listener
        } catch (error) {
            console.error('[useLoggerConfig] Failed to apply preset:', error);
            throw error;
        }
    }, []);

    /**
     * Check if current config matches a specific preset
     */
    const isPresetActive = useCallback(
        (presetName: LoggerPresetName): boolean => {
            if (!config) return false;
            return matchesPreset(config, presetName);
        },
        [config]
    );

    /**
     * Reset config to default (DEVELOPMENT preset)
     */
    const reset = useCallback(async () => {
        try {
            await localStorageLoggerAdapter.setConfig({ ...LOG_PRESETS.DEVELOPMENT });
            // Note: setConfig will be called by the onConfigChange listener
        } catch (error) {
            console.error('[useLoggerConfig] Failed to reset config:', error);
            throw error;
        }
    }, []);

    return {
        config,
        isLoading,
        setCategory,
        setPreset,
        isPresetActive,
        reset,
    };
}
