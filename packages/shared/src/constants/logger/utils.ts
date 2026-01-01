import type { LoggerConfig, LoggerPresetName } from '../../types/logger.js';
import { LOG_PRESETS } from './presets/index.js';

/**
 * Check if a config matches a specific preset
 */
export function matchesPreset(
    config: LoggerConfig,
    presetName: LoggerPresetName
): boolean {
    const preset = LOG_PRESETS[presetName];
    if (!preset) return false;

    return Object.keys(preset).every(
        (key) => config[key as keyof LoggerConfig] === preset[key as keyof LoggerConfig]
    );
}

/**
 * Get the default logger config (DEVELOPMENT preset)
 */
export function getDefaultLoggerConfig(): LoggerConfig {
    return { ...LOG_PRESETS.DEVELOPMENT };
}
