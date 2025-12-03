/**
 * Logger Configuration Storage Service
 * 
 * Provides functions to read/write logger configuration to Chrome storage.
 */
import { LOG_PRESETS } from '@/constants';
import type { LogCategory, LoggerConfig, LoggerPresetName } from '@/types/logger';
import { LOGGER_CONFIG_KEY } from '@/types/logger';

/**
 * Get the current logger configuration from storage
 * Falls back to DEVELOPMENT preset if not set
 */
export async function getLoggerConfig(): Promise<LoggerConfig> {
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
    
    return { ...LOG_PRESETS.DEVELOPMENT };
  } catch {
    return { ...LOG_PRESETS.DEVELOPMENT };
  }
}

/**
 * Save the entire logger configuration to storage
 */
export async function setLoggerConfig(config: LoggerConfig): Promise<void> {
  try {
    await chrome.storage.local.set({ [LOGGER_CONFIG_KEY]: config });
  } catch (error) {
    console.error('[LoggerConfig] Failed to save config:', error);
    throw error;
  }
}

/**
 * Update a single category's enabled state
 */
export async function updateLoggerCategory(
  category: LogCategory,
  enabled: boolean
): Promise<LoggerConfig> {
  const current = await getLoggerConfig();
  const updated: LoggerConfig = {
    ...current,
    [category]: enabled,
  };
  await setLoggerConfig(updated);
  return updated;
}

/**
 * Apply a preset configuration
 */
export async function applyLoggerPreset(presetName: LoggerPresetName): Promise<LoggerConfig> {
  const preset = LOG_PRESETS[presetName];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}`);
  }
  
  const config = { ...preset } as LoggerConfig;
  await setLoggerConfig(config);
  return config;
}

/**
 * Reset logger configuration to default (DEVELOPMENT preset)
 */
export async function resetLoggerConfig(): Promise<LoggerConfig> {
  return applyLoggerPreset('DEVELOPMENT');
}

/**
 * Check if current config matches a preset
 */
export function matchesPreset(config: LoggerConfig, presetName: LoggerPresetName): boolean {
  const preset = LOG_PRESETS[presetName];
  if (!preset) return false;
  
  const presetKeys = Object.keys(preset) as LogCategory[];
  return presetKeys.every((key) => config[key] === preset[key]);
}
