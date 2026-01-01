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
    // Code Mode
    | 'CODE_MODE'
    | 'CODE_MODE_STORE'
    | 'CODE_MODE_CHAT'
    | 'CODE_MODE_BRIDGE'
    | 'CODE_MODE_UI'
    | 'CODE_MODE_PICKER'
    // UI
    | 'UI_CHAT'
    | 'UI_VOICE'
    | 'UI_SETTINGS'
    | 'UI_THREADS'
    | 'UI_SIDEPANEL'
    | 'UI_REMINDERS'
    // UI Sub-categories
    | 'UI_CHAT_COMPONENTS'
    | 'UI_CHAT_HOOKS'
    | 'UI_CHAT_STATE'
    | 'UI_VOICE_COMPONENTS'
    | 'UI_VOICE_HOOKS'
    | 'UI_VOICE_STATE'
    | 'UI_SETTINGS_COMPONENTS'
    | 'UI_SETTINGS_HOOKS'
    | 'UI_SETTINGS_STATE'
    | 'UI_THREADS_COMPONENTS'
    | 'UI_THREADS_HOOKS'
    | 'UI_THREADS_STATE'
    | 'UI_SIDEPANEL_COMPONENTS'
    | 'UI_SIDEPANEL_HOOKS'
    | 'UI_SIDEPANEL_STATE'
    | 'UI_REMINDERS_COMPONENTS'
    | 'UI_REMINDERS_HOOKS'
    | 'UI_REMINDERS_STATE'
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
    // System Sub-categories
    | 'BACKGROUND_LIFECYCLE'
    | 'BACKGROUND_MESSAGING'
    | 'BACKGROUND_SERVICE'
    | 'STORAGE_LOCAL'
    | 'STORAGE_SYNC'
    | 'STORAGE_SESSION'
    | 'STORAGE_DB'
    | 'UTILS_FORMAT'
    | 'UTILS_VALIDATION'
    | 'UTILS_HELPER'
    | 'NOTIFICATIONS_CREATE'
    | 'NOTIFICATIONS_CLEAR'
    | 'NOTIFICATIONS_ACTION'
    | 'CREDENTIALS_VALIDATION'
    | 'CREDENTIALS_STORAGE'
    | 'CREDENTIALS_AUTH'
    | 'SEARCH_PROVIDER'
    | 'SEARCH_RESULTS'
    | 'SEARCH_QUERY'
    | 'SETTINGS_SYNC'
    | 'SETTINGS_MIGRATION'
    | 'SETTINGS_STORE'
    | 'WORKFLOW_ENGINE'
    | 'WORKFLOW_STEP'
    | 'WORKFLOW_ACTION'
    | 'BROWSER_TABS'
    | 'BROWSER_WINDOWS'
    | 'BROWSER_NAVIGATION'
    | 'ATTACHMENTS_PROCESS'
    | 'ATTACHMENTS_STORAGE'
    | 'ATTACHMENTS_UI'
    | 'CONTENT_SCRIPTS_INJECT'
    | 'CONTENT_SCRIPTS_MESSAGE'
    | 'CONTENT_SCRIPTS_DOM'
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
 * Sub-categories for UI_CHAT
 */
export type UIChatSubCategory = 'COMPONENTS' | 'HOOKS' | 'STATE';

/**
 * Sub-categories for UI_VOICE
 */
export type UIVoiceSubCategory = 'COMPONENTS' | 'HOOKS' | 'STATE';

/**
 * Sub-categories for UI_SETTINGS
 */
export type UISettingsSubCategory = 'COMPONENTS' | 'HOOKS' | 'STATE';

/**
 * Sub-categories for UI_THREADS
 */
export type UIThreadsSubCategory = 'COMPONENTS' | 'HOOKS' | 'STATE';

/**
 * Sub-categories for UI_SIDEPANEL
 */
export type UISidepanelSubCategory = 'COMPONENTS' | 'HOOKS' | 'STATE';

/**
 * Sub-categories for BACKGROUND
 */
export type BackgroundSubCategory = 'LIFECYCLE' | 'MESSAGING' | 'SERVICE';

/**
 * Sub-categories for STORAGE
 */
export type StorageSubCategory = 'LOCAL' | 'SYNC' | 'SESSION' | 'DB';

/**
 * Sub-categories for UTILS
 */
export type UtilsSubCategory = 'FORMAT' | 'VALIDATION' | 'HELPER';

/**
 * Sub-categories for NOTIFICATIONS
 */
export type NotificationsSubCategory = 'CREATE' | 'CLEAR' | 'ACTION';

/**
 * Sub-categories for CREDENTIALS
 */
export type CredentialsSubCategory = 'VALIDATION' | 'STORAGE' | 'AUTH';

/**
 * Sub-categories for SEARCH
 */
export type SearchSubCategory = 'PROVIDER' | 'RESULTS' | 'QUERY';

/**
 * Sub-categories for SETTINGS
 */
export type SettingsSubCategory = 'SYNC' | 'MIGRATION' | 'STORE';

/**
 * Sub-categories for WORKFLOW
 */
export type WorkflowSubCategory = 'ENGINE' | 'STEP' | 'ACTION';

/**
 * Sub-categories for BROWSER
 */
export type BrowserSubCategory = 'TABS' | 'WINDOWS' | 'NAVIGATION';

/**
 * Sub-categories for ATTACHMENTS
 */
export type AttachmentsSubCategory = 'PROCESS' | 'STORAGE' | 'UI';

/**
 * Sub-categories for CONTENT_SCRIPTS
 */
export type ContentScriptsSubCategory = 'INJECT' | 'MESSAGE' | 'DOM';

/**
 * Sub-categories for UI_REMINDERS
 */
export type UIRemindersSubCategory = 'COMPONENTS' | 'HOOKS' | 'STATE';

/**
 * Sub-categories for CODE_MODE
 */
export type CodeModeSubCategory = 'STORE' | 'CHAT' | 'BRIDGE' | 'UI' | 'PICKER';

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
    | VoiceAudioSubCategory
    | UIChatSubCategory
    | UIVoiceSubCategory
    | UISettingsSubCategory
    | UIThreadsSubCategory
    | UISidepanelSubCategory
    | UISidepanelSubCategory
    | UIRemindersSubCategory
    | CodeModeSubCategory
    | BackgroundSubCategory
    | StorageSubCategory
    | UtilsSubCategory
    | NotificationsSubCategory
    | CredentialsSubCategory
    | SearchSubCategory
    | SettingsSubCategory
    | WorkflowSubCategory
    | BrowserSubCategory
    | AttachmentsSubCategory
    | ContentScriptsSubCategory;

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
    // UI sub-categories
    UI_CHAT: ['UI_CHAT_COMPONENTS', 'UI_CHAT_HOOKS', 'UI_CHAT_STATE'] as const,
    UI_VOICE: ['UI_VOICE_COMPONENTS', 'UI_VOICE_HOOKS', 'UI_VOICE_STATE'] as const,
    UI_SETTINGS: ['UI_SETTINGS_COMPONENTS', 'UI_SETTINGS_HOOKS', 'UI_SETTINGS_STATE'] as const,
    UI_THREADS: ['UI_THREADS_COMPONENTS', 'UI_THREADS_HOOKS', 'UI_THREADS_STATE'] as const,
    UI_SIDEPANEL: ['UI_SIDEPANEL_COMPONENTS', 'UI_SIDEPANEL_HOOKS', 'UI_SIDEPANEL_STATE'] as const,
    UI_REMINDERS: ['UI_REMINDERS_COMPONENTS', 'UI_REMINDERS_HOOKS', 'UI_REMINDERS_STATE'] as const,
    // Code Mode sub-categories
    CODE_MODE: ['CODE_MODE_STORE', 'CODE_MODE_CHAT', 'CODE_MODE_BRIDGE', 'CODE_MODE_UI', 'CODE_MODE_PICKER'] as const,
    // System sub-categories
    BACKGROUND: ['BACKGROUND_LIFECYCLE', 'BACKGROUND_MESSAGING', 'BACKGROUND_SERVICE'] as const,
    STORAGE: ['STORAGE_LOCAL', 'STORAGE_SYNC', 'STORAGE_SESSION', 'STORAGE_DB'] as const,
    UTILS: ['UTILS_FORMAT', 'UTILS_VALIDATION', 'UTILS_HELPER'] as const,
    NOTIFICATIONS: ['NOTIFICATIONS_CREATE', 'NOTIFICATIONS_CLEAR', 'NOTIFICATIONS_ACTION'] as const,
    CREDENTIALS: ['CREDENTIALS_VALIDATION', 'CREDENTIALS_STORAGE', 'CREDENTIALS_AUTH'] as const,
    SEARCH: ['SEARCH_PROVIDER', 'SEARCH_RESULTS', 'SEARCH_QUERY'] as const,
    SETTINGS: ['SETTINGS_SYNC', 'SETTINGS_MIGRATION', 'SETTINGS_STORE'] as const,
    WORKFLOW: ['WORKFLOW_ENGINE', 'WORKFLOW_STEP', 'WORKFLOW_ACTION'] as const,
    BROWSER: ['BROWSER_TABS', 'BROWSER_WINDOWS', 'BROWSER_NAVIGATION'] as const,
    ATTACHMENTS: ['ATTACHMENTS_PROCESS', 'ATTACHMENTS_STORAGE', 'ATTACHMENTS_UI'] as const,
    CONTENT_SCRIPTS: ['CONTENT_SCRIPTS_INJECT', 'CONTENT_SCRIPTS_MESSAGE', 'CONTENT_SCRIPTS_DOM'] as const,
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
    CodeMode: ['CODE_MODE'] as const,
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

/**
 * Log entry structure for unified logging
 */
export interface LogEntry {
    id: string;
    timestamp: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    category?: LogCategory;
    message: unknown;
    args: unknown[];
    prefix?: string;
}
