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
    // MCP Sub-categories
    | 'MCP_CLIENT_CONNECTION'
    | 'MCP_CLIENT_STATE'
    | 'MCP_CLIENT_UI'
    | 'MCP_TOOLS_METADATA'
    | 'MCP_TOOLS_REGISTRY'
    | 'MCP_EXECUTION_PROXY'
    | 'MCP_EXECUTION_INVOKE'
    | 'MCP_AUTH_OAUTH'
    | 'MCP_AUTH_DISCOVERY'
    | 'MCP_AUTH_SCOPE'
    | 'MCP_SSE_TRANSPORT'
    | 'MCP_SSE_STREAM'
    | 'MCP_SSE_MESSAGE'
    | 'WEBMCP_MANAGER'
    | 'WEBMCP_TOOLS'
    | 'WEBMCP_BACKEND'
    // Tools
    | 'TOOLS_REGISTRY'
    | 'TOOLS_EXECUTION'
    | 'TOOLS_VALIDATION'
    | 'TOOLS_INTEGRATION'
    // Tools Sub-categories
    | 'TOOLS_REGISTRY_CONVERTER'
    | 'TOOLS_REGISTRY_INDEX'
    | 'TOOLS_REGISTRY_UTILS'
    | 'TOOLS_EXECUTION_INVOKE'
    | 'TOOLS_EXECUTION_APPROVAL'
    | 'TOOLS_EXECUTION_SANDBOX'
    | 'TOOLS_EXECUTION_META'
    | 'TOOLS_VALIDATION_SCHEMA'
    | 'TOOLS_VALIDATION_INPUT'
    | 'TOOLS_INTEGRATION_BROWSER'
    | 'TOOLS_INTEGRATION_SEARCH'
    | 'TOOLS_INTEGRATION_RESEARCH'
    // AI
    | 'AI_CHAT'
    | 'AI_PROMPTS'
    | 'AI_VOICE'
    | 'AI_WEBSITE_DETECTION'
    // AI Sub-categories
    | 'AI_CHAT_STREAM'
    | 'AI_CHAT_BACKEND'
    | 'AI_CHAT_SETUP'
    | 'AI_PROMPTS_SUGGESTIONS'
    | 'AI_PROMPTS_SUMMARIZER'
    // Voice
    | 'VOICE_RECORDING'
    | 'VOICE_CLIENT'
    | 'VOICE_UI'
    | 'VOICE_AUDIO'
    // Voice Sub-categories
    | 'VOICE_RECORDING_CAPTURE'
    | 'VOICE_RECORDING_PERMISSIONS'
    | 'VOICE_RECORDING_BUFFER'
    | 'VOICE_CLIENT_CONNECTION'
    | 'VOICE_CLIENT_EVENTS'
    | 'VOICE_CLIENT_STATE'
    | 'VOICE_UI_PANEL'
    | 'VOICE_UI_CONTROLS'
    | 'VOICE_UI_FEEDBACK'
    | 'VOICE_AUDIO_PLAYBACK'
    | 'VOICE_AUDIO_PROCESSING'
    | 'VOICE_AUDIO_LEVELS'
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
 * Sub-categories for MCP_CLIENT
 */
export type MCPClientSubCategory = 'CONNECTION' | 'STATE' | 'UI';

/**
 * Sub-categories for MCP_TOOLS
 */
export type MCPToolsSubCategory = 'METADATA' | 'REGISTRY';

/**
 * Sub-categories for MCP_EXECUTION
 */
export type MCPExecutionSubCategory = 'PROXY' | 'INVOKE';

/**
 * Sub-categories for MCP_AUTH
 */
export type MCPAuthSubCategory = 'OAUTH' | 'DISCOVERY' | 'SCOPE';

/**
 * Sub-categories for MCP_SSE
 */
export type MCPSSESubCategory = 'TRANSPORT' | 'STREAM' | 'MESSAGE';

/**
 * Sub-categories for WEBMCP
 */
export type WEBMCPSubCategory = 'MANAGER' | 'TOOLS' | 'BACKEND';

/**
 * Sub-categories for TOOLS_REGISTRY
 */
export type ToolsRegistrySubCategory = 'CONVERTER' | 'INDEX' | 'UTILS';

/**
 * Sub-categories for TOOLS_EXECUTION
 */
export type ToolsExecutionSubCategory = 'INVOKE' | 'APPROVAL' | 'SANDBOX' | 'META';

/**
 * Sub-categories for TOOLS_VALIDATION
 */
export type ToolsValidationSubCategory = 'SCHEMA' | 'INPUT';

/**
 * Sub-categories for TOOLS_INTEGRATION
 */
export type ToolsIntegrationSubCategory = 'BROWSER' | 'SEARCH' | 'RESEARCH';

/**
 * Sub-categories for AI_CHAT
 */
export type AIChatSubCategory = 'STREAM' | 'BACKEND' | 'SETUP';

/**
 * Sub-categories for AI_PROMPTS
 */
export type AIPromptsSubCategory = 'SUGGESTIONS' | 'SUMMARIZER';
/**
 * Sub-categories for VOICE_RECORDING
 */
export type VoiceRecordingSubCategory = 'CAPTURE' | 'PERMISSIONS' | 'BUFFER';
/**
 * Sub-categories for VOICE_CLIENT
 */
export type VoiceClientSubCategory = 'CONNECTION' | 'EVENTS' | 'STATE';
/**
 * Sub-categories for VOICE_UI
 */
export type VoiceUISubCategory = 'PANEL' | 'CONTROLS' | 'FEEDBACK';
/**
 * Sub-categories for VOICE_AUDIO
 */
export type VoiceAudioSubCategory = 'PLAYBACK' | 'PROCESSING' | 'LEVELS';

/**
 * All sub-category types combined
 */
export type LogSubCategory =
    | MCPClientSubCategory
    | MCPToolsSubCategory
    | MCPExecutionSubCategory
    | MCPAuthSubCategory
    | MCPSSESubCategory
    | WEBMCPSubCategory
    | ToolsRegistrySubCategory
    | ToolsExecutionSubCategory
    | ToolsValidationSubCategory
    | ToolsIntegrationSubCategory
    | AIChatSubCategory
    | AIPromptsSubCategory
    | VoiceRecordingSubCategory
    | VoiceClientSubCategory
    | VoiceUISubCategory
    | VoiceAudioSubCategory;

/**
 * Sub-category groups per main category
 * Maps categories that have sub-categories to their full sub-category key names
 */
export const LOGGER_SUBCATEGORY_GROUPS = {
    MCP_CLIENT: ['MCP_CLIENT_CONNECTION', 'MCP_CLIENT_STATE', 'MCP_CLIENT_UI'] as const,
    MCP_TOOLS: ['MCP_TOOLS_METADATA', 'MCP_TOOLS_REGISTRY'] as const,
    MCP_EXECUTION: ['MCP_EXECUTION_PROXY', 'MCP_EXECUTION_INVOKE'] as const,
    MCP_AUTH: ['MCP_AUTH_OAUTH', 'MCP_AUTH_DISCOVERY', 'MCP_AUTH_SCOPE'] as const,
    MCP_SSE: ['MCP_SSE_TRANSPORT', 'MCP_SSE_STREAM', 'MCP_SSE_MESSAGE'] as const,
    WEBMCP: ['WEBMCP_MANAGER', 'WEBMCP_TOOLS', 'WEBMCP_BACKEND'] as const,
    // Tools sub-categories
    TOOLS_REGISTRY: ['TOOLS_REGISTRY_CONVERTER', 'TOOLS_REGISTRY_INDEX', 'TOOLS_REGISTRY_UTILS'] as const,
    TOOLS_EXECUTION: ['TOOLS_EXECUTION_INVOKE', 'TOOLS_EXECUTION_APPROVAL', 'TOOLS_EXECUTION_SANDBOX', 'TOOLS_EXECUTION_META'] as const,
    TOOLS_VALIDATION: ['TOOLS_VALIDATION_SCHEMA', 'TOOLS_VALIDATION_INPUT'] as const,
    TOOLS_INTEGRATION: ['TOOLS_INTEGRATION_BROWSER', 'TOOLS_INTEGRATION_SEARCH', 'TOOLS_INTEGRATION_RESEARCH'] as const,
    // AI sub-categories
    AI_CHAT: ['AI_CHAT_STREAM', 'AI_CHAT_BACKEND', 'AI_CHAT_SETUP'] as const,
    AI_PROMPTS: ['AI_PROMPTS_SUGGESTIONS', 'AI_PROMPTS_SUMMARIZER'] as const,
    // Voice sub-categories
    VOICE_RECORDING: ['VOICE_RECORDING_CAPTURE', 'VOICE_RECORDING_PERMISSIONS', 'VOICE_RECORDING_BUFFER'] as const,
    VOICE_CLIENT: ['VOICE_CLIENT_CONNECTION', 'VOICE_CLIENT_EVENTS', 'VOICE_CLIENT_STATE'] as const,
    VOICE_UI: ['VOICE_UI_PANEL', 'VOICE_UI_CONTROLS', 'VOICE_UI_FEEDBACK'] as const,
    VOICE_AUDIO: ['VOICE_AUDIO_PLAYBACK', 'VOICE_AUDIO_PROCESSING', 'VOICE_AUDIO_LEVELS'] as const,
} as const;

/**
 * Type for categories that have sub-categories
 */
export type CategoryWithSubCategories = keyof typeof LOGGER_SUBCATEGORY_GROUPS;

/**
 * Check if a category has sub-categories
 */
export function hasSubCategories(category: LogCategory): category is CategoryWithSubCategories {
    return category in LOGGER_SUBCATEGORY_GROUPS;
}

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
