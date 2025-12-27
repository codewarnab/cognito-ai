/**
 * Feature Flags
 * Shared feature flags for the Cognito AI monorepo
 * 
 * These flags control feature visibility and behavior across
 * the extension, webapp, and backend services.
 */

/**
 * Web Search Self API Key Hidden Configuration
 * When enabled (true), the extension uses the backend's Tavily API key instead of requiring
 * users to configure their own. This:
 * - Hides the Tavily API key input in settings (extension and webapp)
 * - Enables web search by default using the backend proxy
 * 
 * Set to `true` for production builds where API keys are managed server-side.
 * Set to `false` for development or when users should provide their own keys.
 */
export const WEB_SEARCH_SELF_API_KEY_HIDDEN = true;

/**
 * Hide Auto Extract Insights Configuration
 * When enabled (true), the extension disables all auto-extraction and memory features.
 * This:
 * - Hides the Supermemory/Auto-Extraction settings in the webapp
 * - Prevents background alarms from triggering extraction
 * - Prevents extraction triggers from content scripts
 */
export const HIDE_AUTO_EXTRACT_INSIGHTS = true;
