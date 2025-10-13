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
