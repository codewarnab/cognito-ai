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
export const COPILOT_RUNTIME_URL = "https://backend-dun-eta-47.vercel.app/api" as string; // TODO: Edit this URL
export const COPILOT_RUNTIME_URL_DEFAULT = "https://backend-dun-eta-47.vercel.app/";

/**
 * Notion MCP Configuration
 * OAuth (PKCE) and SSE endpoint settings for Notion hosted MCP server
 * 
 * IMPORTANT: This uses Notion's MCP OAuth flow (PKCE, no client secret)
 * NOT the custom integration OAuth flow.
 * 
 * Get your MCP client ID from the Notion MCP developer portal.
 * It should be a short alphanumeric string (e.g., "Oh46dYkUrzferlRE"),
 * NOT a UUID like "28bd872b-594c-805a-a31a-0037c381dd8c".
 */
export const NOTION_CONFIG = {
    /** 
     * Notion MCP OAuth Client ID (short format, NOT integration UUID)
     * Get from: https://developers.notion.com/docs/mcp
     * Example: "Oh46dYkUrzferlRE"
     */
    OAUTH_CLIENT_ID: process.env.PLASMO_PUBLIC_NOTION_MCP_CLIENT_ID || "Oh46dYkUrzferlRE",

    /** OAuth redirect URI - Chrome extension identity redirect */
    OAUTH_REDIRECT_URI: "https://finfnkhchelfofloocidpepacfbajmlh.chromiumapp.org/",

    /** OAuth authorization endpoint - MCP hosted (PKCE) */
    OAUTH_AUTH_URL: "https://mcp.notion.com/authorize",

    /** OAuth token endpoint - MCP hosted (PKCE) */
    OAUTH_TOKEN_URL: "https://mcp.notion.com/token",

    /** MCP resource identifier for OAuth scope */
    MCP_RESOURCE: "https://mcp.notion.com/",

    /** Notion MCP base endpoint (for HTTP POST requests) */
    MCP_BASE_URL: "https://mcp.notion.com/mcp",

    /** Notion MCP SSE endpoint (for receiving events) */
    MCP_SSE_URL: "https://mcp.notion.com/sse",

    /** Token storage key prefix */
    STORAGE_KEY_PREFIX: "oauth.notion.mcp",

    /** Reconnection settings */
    RECONNECT_MIN_DELAY: 500, // 0.5s
    RECONNECT_MAX_DELAY: 30000, // 30s
    RECONNECT_MULTIPLIER: 2,
} as const;
