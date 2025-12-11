/**
 * Logger Configuration Types
 * 
 * Types for the dynamic logger configuration system that allows
 * runtime enabling/disabling of log categories.
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
  // System
  | 'BACKGROUND'
  | 'STORAGE'
  | 'UTILS'
  | 'NOTIFICATIONS'
  | 'CREDENTIALS'
  | 'SEARCH'
  | 'SETTINGS'
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
  System: ['BACKGROUND', 'STORAGE', 'UTILS', 'NOTIFICATIONS', 'CREDENTIALS', 'SEARCH', 'SETTINGS'] as const,
  Debug: ['DEBUG', 'PERFORMANCE', 'ERRORS_ONLY', 'SHOW_ALL'] as const,
} as const;
