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
 * CopilotKit Configuration
 * Edit this URL to point to your hosted Copilot Runtime endpoint
 * Example: "https://your-runtime.example.com/api/copilotkit"
 */
export const COPILOT_RUNTIME_URL = " http://localhost:3000/api" as string; // TODO: Edit this URL
export const COPILOT_RUNTIME_URL_DEFAULT = " http://localhost:3000/";

/**
 * Generic MCP OAuth Configuration
 * Applies to all MCP servers with OAuth authentication
 */
export const MCP_OAUTH_CONFIG = {
    /** OAuth redirect URI - Chrome extension identity redirect (same for all servers) */
    REDIRECT_URI: "https://finfnkhchelfofloocidpepacfbajmlh.chromiumapp.org/",

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

