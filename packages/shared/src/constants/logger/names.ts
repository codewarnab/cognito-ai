import type { LoggerPresetName } from '../../types/logger.js';

/**
 * Ordered list of preset names for UI display
 */
export const LOGGER_PRESET_NAMES: readonly LoggerPresetName[] = [
    'DEVELOPMENT',
    'DEBUG_MCP',
    'DEBUG_VOICE',
    'DEBUG_TOOLS',
    'DEBUG_SANDBOX',
    'DEBUG_WORKFLOW',
    'PRODUCTION',
    'QUIET',
    'VERBOSE',
] as const;
