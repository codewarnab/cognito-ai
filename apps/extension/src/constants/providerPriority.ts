/**
 * Provider Priority Configuration
 * Configures the priority order for AI provider selection when multiple providers are available.
 *
 * PRIORITY ORDER RATIONALE:
 * - Google/Vertex are prioritized because they support richer tool features:
 *   - URL Context (fetch and analyze web pages)
 *   - Google Search grounding
 *   - Full function calling with built-in tools
 * - OpenAI is lower priority but still fully supported with:
 *   - Function calling
 *   - Web search (via Responses API)
 *
 * USAGE: When a user has multiple providers configured, the system will select
 * the first available provider in this priority order.
 *
 * To change provider priority, simply reorder this array.
 *
 * @see ../background/providers/capabilities.ts for provider capability details
 */

export const PROVIDER_PRIORITY = [
    'google', // 1st priority - Google AI (Gemini API) - full tool support
    'vertex', // 2nd priority - Vertex AI - full tool support
    'openai', // 3rd priority - OpenAI - function calling + web search
    'anthropic', // 4th priority - Anthropic (Claude) - function calling + web search
    'xai', // 5th priority - xAI (Grok) - function calling
    // Future providers can be added here:
    // 'deepseek',
    // 'groq',
    // 'ollama',
] as const;

export type AIProviderType = (typeof PROVIDER_PRIORITY)[number];
