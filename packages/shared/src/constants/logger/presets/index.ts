/**
 * Logger Presets
 *
 * Pre-configured logging configurations for common development scenarios.
 * Used by both the Chrome extension and webapp logger panel.
 */
import type { LoggerConfig, LoggerPresetName } from '../../../types/logger.js';

import { DEVELOPMENT_PRESET } from './development.js';
import { DEBUG_MCP_PRESET } from './debug-mcp.js';
import { DEBUG_VOICE_PRESET } from './debug-voice.js';
import { DEBUG_TOOLS_PRESET } from './debug-tools.js';
import { DEBUG_SANDBOX_PRESET } from './debug-sandbox.js';
import { DEBUG_WORKFLOW_PRESET } from './debug-workflow.js';
import { PRODUCTION_PRESET } from './production.js';
import { QUIET_PRESET } from './quiet.js';
import { VERBOSE_PRESET } from './verbose.js';

/**
 * Logging Presets - Quick configurations for common scenarios
 */
export const LOG_PRESETS: Record<LoggerPresetName, LoggerConfig> = {
    DEVELOPMENT: DEVELOPMENT_PRESET,
    DEBUG_MCP: DEBUG_MCP_PRESET,
    DEBUG_VOICE: DEBUG_VOICE_PRESET,
    DEBUG_TOOLS: DEBUG_TOOLS_PRESET,
    DEBUG_SANDBOX: DEBUG_SANDBOX_PRESET,
    DEBUG_WORKFLOW: DEBUG_WORKFLOW_PRESET,
    PRODUCTION: PRODUCTION_PRESET,
    QUIET: QUIET_PRESET,
    VERBOSE: VERBOSE_PRESET,
};
