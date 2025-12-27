/**
 * Content Script Models
 * 
 * Models used internally by content script features (summarizer, writer, rewriter).
 * These are DEVELOPER-CONTROLLED and NOT user-selectable in the UI.
 * 
 * The goal is to use cost-efficient models for these lightweight features
 * while reserving heavier models for main chat/agent functionality.
 */

export const CONTENT_SCRIPT_MODELS = {
    /** Google AI (Gemini API) - uses Flash Lite for cost efficiency */
    google: {
        model: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    },
    /** Vertex AI - same model as Google AI */
    vertex: {
        model: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        // Vertex endpoint is constructed dynamically with location
    },
    /** OpenAI - GPT 5 Mini for balance between speed and quality */
    openai: {
        model: 'gpt-5-mini',
        name: 'GPT 5 Mini',
        apiEndpoint: 'https://api.openai.com/v1',
    },
    /** Anthropic - Claude Haiku 4.5 for fast, cost-efficient generation */
    anthropic: {
        model: 'claude-haiku-4-5',
        name: 'Claude Haiku 4.5',
        apiEndpoint: 'https://api.anthropic.com/v1',
    },
    /** xAI - Grok 2 for high performance background tasks */
    xai: {
        model: 'grok-2-1212',
        name: 'Grok 2',
        apiEndpoint: 'https://api.x.ai/v1',
    },
} as const;

/** Type union of supported providers for content scripts */
export type ContentScriptProvider = keyof typeof CONTENT_SCRIPT_MODELS;

/**
 * Get the model configuration for a specific provider
 * @param provider - The AI provider to get model config for
 * @returns The model configuration or undefined if not supported
 */
export function getContentScriptModel(provider: ContentScriptProvider) {
    return CONTENT_SCRIPT_MODELS[provider];
}
