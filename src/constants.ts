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
 * Notion MCP Configuration
 * OAuth with Dynamic Client Registration for Notion hosted MCP server
 * 
 * IMPORTANT: This uses dynamic client registration (RFC 7591)
 * Client credentials are obtained at runtime when the user clicks "Connect"
 */
export const NOTION_CONFIG = {
    /** OAuth redirect URI - Chrome extension identity redirect */
    OAUTH_REDIRECT_URI: "https://finfnkhchelfofloocidpepacfbajmlh.chromiumapp.org/",

    /** OAuth dynamic client registration endpoint */
    OAUTH_REGISTER_URL: "https://mcp.notion.com/register",

    /** OAuth authorization endpoint - Standard Notion OAuth */
    OAUTH_AUTH_URL: "https://mcp.notion.com/authorize",

    /** OAuth token endpoint - Standard Notion OAuth */
    OAUTH_TOKEN_URL: "https://mcp.notion.com/token",

    /** OAuth token introspection endpoint */
    OAUTH_INTROSPECT_URL: "https://api.notion.com/v1/oauth/introspect",

    /** MCP resource identifier for OAuth scope */
    MCP_RESOURCE: "https://mcp.notion.com/",

    /** Notion MCP SSE endpoint (for establishing SSE connection and receiving events) */
    MCP_SSE_URL: "https://mcp.notion.com/sse",

    /** Token storage key prefix */
    STORAGE_KEY_PREFIX: "oauth.notion.mcp",

    /** Reconnection settings */
    RECONNECT_MIN_DELAY: 500, // 0.5s
    RECONNECT_MAX_DELAY: 30000, // 30s
    RECONNECT_MULTIPLIER: 2,
} as const;
