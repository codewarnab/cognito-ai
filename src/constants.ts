/**
 * Configuration constants for the extension
 */

// Chrome Built-in AI (Gemini Nano) limits
// Based on Chrome AI documentation and community reports
export const CHROME_AI_LIMITS = {
    /** Maximum tokens per single prompt to Gemini Nano (on-device model) */
    MAX_TOKENS_PER_PROMPT: 1024,

    /** Maximum tokens for session retention (sliding window) */
    MAX_TOKENS_PER_SESSION: 4096,

    /** Recommended chunk size for text processing to stay well under prompt limit */
    RECOMMENDED_CHUNK_TOKENS: 800,

    /** Maximum output tokens per response */
    MAX_OUTPUT_TOKENS: 1024,
} as const;

/**
 * Generic MCP OAuth Configuration
 * Applies to all MCP servers with OAuth authentication
 */
export const MCP_OAUTH_CONFIG = {
    /** OAuth redirect URI - Chrome extension identity redirect (same for all servers) */
    // NOTE: This will be dynamically set at runtime using chrome.identity.getRedirectURL()
    // to ensure it matches the actual extension ID in both dev and prod builds
    REDIRECT_URI: "", // Will be set at runtime

    /** Storage key prefix format: oauth.{serverId}.tokens */
    STORAGE_KEY_PREFIX: "oauth",

    /** Token refresh timing */
    TOKEN_REFRESH_BUFFER: 5 * 60 * 1000, // 5 minutes before expiry

    /** Reconnection settings */
    RECONNECT_MIN_DELAY: 500, // 0.5s
    RECONNECT_MAX_DELAY: 30000, // 30s
    RECONNECT_MULTIPLIER: 2,

    /** Discovery timeouts */
    DISCOVERY_TIMEOUT: 10000, // 10s timeout for discovery requests
} as const;

/**
 * Server-specific configurations
 * Optional overrides and custom settings per server
 * 
 * Note: Discovery endpoints are determined via RFC 9728 (Protected Resource Metadata)
 * and RFC 8414 (Authorization Server Metadata) discovery. Do NOT hardcode endpoints here
 * as it violates the MCP specification. Instead, use custom headers for server-specific
 * requirements like the Notion-Version header.
 */
export const SERVER_SPECIFIC_CONFIGS: Record<string, {
    customHeaders?: Record<string, string>;
}> = {

};

/**
 * Tools Configuration
 * Settings related to tool management and warnings
 */
export const TOOLS_WARNING_THRESHOLD = 40 as const;

/**
 * External API Endpoints
 */
export const TRANSCRIPT_API_URL =
    'https://youtube-transcript-generator-five.vercel.app/simple-transcript' as const;

/**
 * Logging Configuration
 * Control which features should output logs to console
 */
export const LOG_CONFIG = {
    // MCP Related Logs
    MCP_CLIENT: true,           // MCP client initialization, connections
    MCP_TOOLS: true,            // MCP tool listing, registration
    MCP_EXECUTION: true,        // MCP tool execution
    MCP_AUTH: true,             // MCP OAuth flows
    MCP_SSE: false,             // Detailed SSE transport logs (verbose)

    // Tool Related Logs
    TOOLS_REGISTRY: true,       // Tool registration, discovery
    TOOLS_EXECUTION: true,      // Tool execution (extension tools)
    TOOLS_VALIDATION: false,    // Tool schema validation (verbose)
    TOOLS_INTEGRATION: true,    // Tool integration tests

    // AI Related Logs
    AI_CHAT: true,              // Chat completions, streaming
    AI_PROMPTS: true,           // Prompt generation, system instructions
    AI_VOICE: true,             // Voice mode AI (Gemini Live)
    AI_WEBSITE_DETECTION: false, // Website-specific prompts (verbose)

    // Voice Related Logs
    VOICE_RECORDING: false,     // Speech recognition, audio capture (verbose)
    VOICE_CLIENT: true,         // Gemini Live client initialization
    VOICE_UI: false,            // Voice mode UI state changes (verbose)
    VOICE_AUDIO: false,         // Audio processing, orb visualization (verbose)

    // Memory System Logs
    MEMORY_OPERATIONS: true,    // Memory save, retrieve, delete
    MEMORY_SUGGESTIONS: false,  // Memory suggestion generation (verbose)

    // Background & Storage Logs
    BACKGROUND: true,           // Background script operations
    STORAGE: false,             // Storage operations (verbose)

    // Utility & Helper Logs
    UTILS: false,               // General utility functions (verbose)
    NOTIFICATIONS: true,        // Notification system
    CREDENTIALS: true,          // Provider credentials management

    // Debug & Development
    DEBUG: false,               // Debug panels, test tools
    PERFORMANCE: false,         // Performance metrics (verbose)

    // Special Categories
    ERRORS_ONLY: false  ,         // When true, ONLY show errors (overrides all above)
    SHOW_ALL: true ,            // When true, show ALL logs (overrides all above)
} as const;

export type LogCategory = keyof typeof LOG_CONFIG;

/**
 * Logging Presets - Quick configurations for common scenarios
 * 
 * To use a preset, replace the LOG_CONFIG export with:
 * export const LOG_CONFIG = LOG_PRESETS.DEVELOPMENT;
 */
export const LOG_PRESETS = {
    // Development - Show most logs except very verbose ones
    DEVELOPMENT: {
        ...LOG_CONFIG,
        MCP_SSE: false,
        TOOLS_VALIDATION: false,
        VOICE_RECORDING: false,
        VOICE_UI: false,
        VOICE_AUDIO: false,
        STORAGE: false,
        UTILS: false,
        AI_WEBSITE_DETECTION: false,
        MEMORY_SUGGESTIONS: false,
        PERFORMANCE: false,
    },

    // Debugging MCP Issues
    DEBUG_MCP: {
        MCP_CLIENT: true,
        MCP_TOOLS: true,
        MCP_EXECUTION: true,
        MCP_AUTH: true,
        MCP_SSE: true,
        TOOLS_REGISTRY: false,
        TOOLS_EXECUTION: false,
        TOOLS_VALIDATION: false,
        TOOLS_INTEGRATION: false,
        AI_CHAT: false,
        AI_PROMPTS: false,
        AI_VOICE: false,
        AI_WEBSITE_DETECTION: false,
        VOICE_RECORDING: false,
        VOICE_CLIENT: false,
        VOICE_UI: false,
        VOICE_AUDIO: false,
        MEMORY_OPERATIONS: false,
        MEMORY_SUGGESTIONS: false,
        BACKGROUND: false,
        STORAGE: false,
        UTILS: false,
        NOTIFICATIONS: false,
        CREDENTIALS: false,
        DEBUG: false,
        PERFORMANCE: false,
        ERRORS_ONLY: false,
        SHOW_ALL: false,
    },

    // Debugging Voice Issues
    DEBUG_VOICE: {
        MCP_CLIENT: false,
        MCP_TOOLS: false,
        MCP_EXECUTION: false,
        MCP_AUTH: false,
        MCP_SSE: false,
        TOOLS_REGISTRY: false,
        TOOLS_EXECUTION: false,
        TOOLS_VALIDATION: false,
        TOOLS_INTEGRATION: false,
        AI_CHAT: false,
        AI_PROMPTS: false,
        AI_VOICE: true,
        AI_WEBSITE_DETECTION: false,
        VOICE_RECORDING: true,
        VOICE_CLIENT: true,
        VOICE_UI: true,
        VOICE_AUDIO: true,
        MEMORY_OPERATIONS: false,
        MEMORY_SUGGESTIONS: false,
        BACKGROUND: false,
        STORAGE: false,
        UTILS: false,
        NOTIFICATIONS: false,
        CREDENTIALS: false,
        DEBUG: false,
        PERFORMANCE: false,
        ERRORS_ONLY: false,
        SHOW_ALL: false,
    },

    // Debugging Tool Execution
    DEBUG_TOOLS: {
        MCP_CLIENT: false,
        MCP_TOOLS: false,
        MCP_EXECUTION: false,
        MCP_AUTH: false,
        MCP_SSE: false,
        TOOLS_REGISTRY: true,
        TOOLS_EXECUTION: true,
        TOOLS_VALIDATION: true,
        TOOLS_INTEGRATION: true,
        AI_CHAT: false,
        AI_PROMPTS: false,
        AI_VOICE: false,
        AI_WEBSITE_DETECTION: false,
        VOICE_RECORDING: false,
        VOICE_CLIENT: false,
        VOICE_UI: false,
        VOICE_AUDIO: false,
        MEMORY_OPERATIONS: false,
        MEMORY_SUGGESTIONS: false,
        BACKGROUND: false,
        STORAGE: false,
        UTILS: false,
        NOTIFICATIONS: false,
        CREDENTIALS: false,
        DEBUG: false,
        PERFORMANCE: false,
        ERRORS_ONLY: false,
        SHOW_ALL: false,
    },

    // Production - Errors only
    PRODUCTION: {
        MCP_CLIENT: false,
        MCP_TOOLS: false,
        MCP_EXECUTION: false,
        MCP_AUTH: false,
        MCP_SSE: false,
        TOOLS_REGISTRY: false,
        TOOLS_EXECUTION: false,
        TOOLS_VALIDATION: false,
        TOOLS_INTEGRATION: false,
        AI_CHAT: false,
        AI_PROMPTS: false,
        AI_VOICE: false,
        AI_WEBSITE_DETECTION: false,
        VOICE_RECORDING: false,
        VOICE_CLIENT: false,
        VOICE_UI: false,
        VOICE_AUDIO: false,
        MEMORY_OPERATIONS: false,
        MEMORY_SUGGESTIONS: false,
        BACKGROUND: false,
        STORAGE: false,
        UTILS: false,
        NOTIFICATIONS: false,
        CREDENTIALS: false,
        DEBUG: false,
        PERFORMANCE: false,
        ERRORS_ONLY: true,
        SHOW_ALL: false,
    },

    // Quiet - Minimal logging
    QUIET: {
        MCP_CLIENT: true,
        MCP_TOOLS: false,
        MCP_EXECUTION: false,
        MCP_AUTH: false,
        MCP_SSE: false,
        TOOLS_REGISTRY: false,
        TOOLS_EXECUTION: false,
        TOOLS_VALIDATION: false,
        TOOLS_INTEGRATION: false,
        AI_CHAT: false,
        AI_PROMPTS: false,
        AI_VOICE: false,
        AI_WEBSITE_DETECTION: false,
        VOICE_RECORDING: false,
        VOICE_CLIENT: false,
        VOICE_UI: false,
        VOICE_AUDIO: false,
        MEMORY_OPERATIONS: false,
        MEMORY_SUGGESTIONS: false,
        BACKGROUND: true,
        STORAGE: false,
        UTILS: false,
        NOTIFICATIONS: true,
        CREDENTIALS: false,
        DEBUG: false,
        PERFORMANCE: false,
        ERRORS_ONLY: false,
        SHOW_ALL: false,
    },

    // Verbose - Show everything
    VERBOSE: {
        MCP_CLIENT: true,
        MCP_TOOLS: true,
        MCP_EXECUTION: true,
        MCP_AUTH: true,
        MCP_SSE: true,
        TOOLS_REGISTRY: true,
        TOOLS_EXECUTION: true,
        TOOLS_VALIDATION: true,
        TOOLS_INTEGRATION: true,
        AI_CHAT: true,
        AI_PROMPTS: true,
        AI_VOICE: true,
        AI_WEBSITE_DETECTION: true,
        VOICE_RECORDING: true,
        VOICE_CLIENT: true,
        VOICE_UI: true,
        VOICE_AUDIO: true,
        MEMORY_OPERATIONS: true,
        MEMORY_SUGGESTIONS: true,
        BACKGROUND: true,
        STORAGE: true,
        UTILS: true,
        NOTIFICATIONS: true,
        CREDENTIALS: true,
        DEBUG: true,
        PERFORMANCE: true,
        ERRORS_ONLY: false,
        SHOW_ALL: true,
    },
} as const;

