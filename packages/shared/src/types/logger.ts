/**
 * Logger Configuration Types
 *
 * Types for the dynamic logger configuration system that allows
 * runtime enabling/disabling of log categories.
 *
 * Used by both the Chrome extension and webapp for logger panel UI.
 */

/**
 * All available log categories
 */
export type LogCategory =
    // MCP
    | 'MCP_CLIENT'
    | 'MCP_TOOLS'
    | 'MCP_EXECUTION'
    | 'MCP_AUTH'
    | 'MCP_SSE'
    | 'WEBMCP'
    // Tools
    | 'TOOLS_REGISTRY'
    | 'TOOLS_EXECUTION'
    | 'TOOLS_VALIDATION'
    | 'TOOLS_INTEGRATION'
    // AI
    | 'AI_CHAT'
    | 'AI_PROMPTS'
    | 'AI_VOICE'
    | 'AI_WEBSITE_DETECTION'
    // Voice
    | 'VOICE_RECORDING'
    | 'VOICE_CLIENT'
    | 'VOICE_UI'
    | 'VOICE_AUDIO'
    // Memory
    | 'MEMORY_OPERATIONS'
    | 'MEMORY_SUGGESTIONS'
    // UI
    | 'UI_CHAT'
    | 'UI_VOICE'
    | 'UI_SETTINGS'
    | 'UI_THREADS'
    | 'UI_SIDEPANEL'
    | 'UI_REMINDERS'
    // System
    | 'BACKGROUND'
    | 'STORAGE'
    | 'UTILS'
    | 'NOTIFICATIONS'
    | 'CREDENTIALS'
    | 'SEARCH'
    | 'WORKFLOW'
    | 'SETTINGS'
    | 'BROWSER'
    | 'ATTACHMENTS'
    | 'CONTENT_SCRIPTS'
    // Debug
    | 'DEBUG'
    | 'PERFORMANCE'
    | 'ERRORS_ONLY'
    | 'SHOW_ALL';

/**
 * Logger configuration - maps each category to enabled/disabled state
 */
export type LoggerConfig = Record<LogCategory, boolean>;

/**
 * Available preset names
 */
export type LoggerPresetName =
    | 'DEVELOPMENT'
    | 'DEBUG_MCP'
    | 'DEBUG_VOICE'
    | 'DEBUG_TOOLS'
    | 'DEBUG_SANDBOX'
    | 'DEBUG_WORKFLOW'
    | 'PRODUCTION'
    | 'QUIET'
    | 'VERBOSE';

/**
 * Storage key for logger configuration
 */
export const LOGGER_CONFIG_KEY = 'logger_config';

/**
 * Category groups for UI organization
 */
export const LOGGER_CATEGORY_GROUPS = {
    MCP: ['MCP_CLIENT', 'MCP_TOOLS', 'MCP_EXECUTION', 'MCP_AUTH', 'MCP_SSE', 'WEBMCP'] as const,
    Tools: ['TOOLS_REGISTRY', 'TOOLS_EXECUTION', 'TOOLS_VALIDATION', 'TOOLS_INTEGRATION'] as const,
    AI: ['AI_CHAT', 'AI_PROMPTS', 'AI_VOICE', 'AI_WEBSITE_DETECTION'] as const,
    Voice: ['VOICE_RECORDING', 'VOICE_CLIENT', 'VOICE_UI', 'VOICE_AUDIO'] as const,
    Memory: ['MEMORY_OPERATIONS', 'MEMORY_SUGGESTIONS'] as const,
    UI: ['UI_CHAT', 'UI_VOICE', 'UI_SETTINGS', 'UI_THREADS', 'UI_SIDEPANEL', 'UI_REMINDERS'] as const,
    System: [
        'BACKGROUND',
        'STORAGE',
        'UTILS',
        'NOTIFICATIONS',
        'CREDENTIALS',
        'SEARCH',
        'SETTINGS',
        'WORKFLOW',
        'BROWSER',
        'ATTACHMENTS',
        'CONTENT_SCRIPTS',
    ] as const,
    Debug: ['DEBUG', 'PERFORMANCE', 'ERRORS_ONLY', 'SHOW_ALL'] as const,
} as const;

/**
 * Group name type derived from LOGGER_CATEGORY_GROUPS
 */
export type LoggerCategoryGroup = keyof typeof LOGGER_CATEGORY_GROUPS;
