/**
 * @cognito/shared - Constants
 * Re-exports all shared constants
 */

export {
    TONE_INSTRUCTIONS,
    PLATFORM_INSTRUCTIONS,
    PRESET_PROMPTS,
    SUMMARY_TYPE_INSTRUCTIONS,
    SUMMARY_LENGTH_TOKENS,
    SUGGESTION_CAPABILITIES,
} from './prompts.js';

export { WEB_SEARCH_SELF_API_KEY_HIDDEN, HIDE_AUTO_EXTRACT_INSIGHTS } from './featureFlags.js';

// Logger presets and utilities
export {
    LOG_PRESETS,
    LOGGER_GROUP_LABELS,
    LOGGER_PRESET_NAMES,
    matchesPreset,
    getDefaultLoggerConfig,
} from './logger.js';

// MCP Server Registry (security-critical)
export {
    MCP_SERVER_REGISTRY,
    type McpServerRegistryEntry,
    type McpStdioRequest,
    type McpExecuteRequest,
} from './mcpRegistry.js';

// API URLs
export { TAVILY_API_URL } from './urls.js';
