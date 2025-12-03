/**
 * useLoggerConfig Hook
 * 
 * React hook for managing logger configuration with Chrome storage persistence.
 * Provides real-time sync across all extension contexts.
 */
import { useState, useEffect, useCallback } from 'react';
import type { LogCategory, LoggerConfig, LoggerPresetName } from '@/types/logger';
import { LOGGER_CONFIG_KEY } from '@/types/logger';
import {
  getLoggerConfig,
  setLoggerConfig,
  updateLoggerCategory,
  applyLoggerPreset,
  matchesPreset,
} from '@/utils/settings/loggerConfig';

interface UseLoggerConfigReturn {
  /** Current logger configuration */
  config: LoggerConfig | null;
  /** Whether the config is still loading */
  isLoading: boolean;
  /** Set a single category's enabled state */
  setCategory: (category: LogCategory, enabled: boolean) => Promise<void>;
  /** Apply a preset configuration */
  setPreset: (presetName: LoggerPresetName) => Promise<void>;
  /** Check if current config matches a preset */
  isPresetActive: (presetName: LoggerPresetName) => boolean;
  /** Reset to default configuration */
  reset: () => Promise<void>;
}

/**
 * Hook to manage logger configuration with storage persistence
 */
export function useLoggerConfig(): UseLoggerConfigReturn {
  const [config, setConfig] = useState<LoggerConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const loaded = await getLoggerConfig();
        setConfig(loaded);
      } catch (error) {
        console.error('[useLoggerConfig] Failed to load config:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  // Listen for storage changes (cross-context sync)
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes[LOGGER_CONFIG_KEY]) {
        const newConfig = changes[LOGGER_CONFIG_KEY].newValue as LoggerConfig;
        if (newConfig) {
          setConfig(newConfig);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const setCategory = useCallback(async (category: LogCategory, enabled: boolean) => {
    try {
      const updated = await updateLoggerCategory(category, enabled);
      setConfig(updated);
    } catch (error) {
      console.error('[useLoggerConfig] Failed to update category:', error);
      throw error;
    }
  }, []);

  const setPreset = useCallback(async (presetName: LoggerPresetName) => {
    try {
      const updated = await applyLoggerPreset(presetName);
      setConfig(updated);
    } catch (error) {
      console.error('[useLoggerConfig] Failed to apply preset:', error);
      throw error;
    }
  }, []);

  const isPresetActive = useCallback((presetName: LoggerPresetName): boolean => {
    if (!config) return false;
    return matchesPreset(config, presetName);
  }, [config]);

  const reset = useCallback(async () => {
    try {
      const { resetLoggerConfig } = await import('@/utils/settings/loggerConfig');
      const updated = await resetLoggerConfig();
      setConfig(updated);
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
