/**
 * Provider Capabilities
 * Defines what features each AI provider supports
 *
 * This module provides a capability registry for AI providers, enabling:
 * - Feature detection for UI gating (disable unavailable features)
 * - Dynamic tool routing based on provider capabilities
 * - Extensibility for future providers
 */

/**
 * Provider capability flags
 * Each flag indicates whether a provider supports a specific feature
 */
export interface ProviderCapabilities {
    /** Provider supports function calling / tool use */
    functionCalling: boolean;

    /** Provider supports web search (any implementation) */
    webSearch: boolean;

    /** Provider supports URL context/fetching (Gemini-specific feature) */
    urlContext: boolean;

    /** Provider supports multimodal inputs (images, PDFs) */
    multimodal: boolean;

    /** Provider supports streaming responses */
    streaming: boolean;

    /** Provider supports memory/function calling for Supermemory */
    memoryFunctionCalling: boolean;
}

/**
 * Web Search Implementation Types
 *
 * Each provider may implement web search differently:
 * - google_search: Uses `{ google_search: {} }` built-in tool (Gemini)
 * - openai_responses: Uses OpenAI Responses API with `{ type: "web_search" }`
 * - native: Built-in search (e.g., Perplexity - no explicit tool needed)
 * - none: No web search support
 */
export type WebSearchImplementation =
    | 'google_search'
    | 'openai_responses'
    | 'anthropic_server_tool'
    | 'native'
    | 'none';

/**
 * Web search implementation for each provider
 */
export const WEB_SEARCH_IMPLEMENTATIONS: Record<string, WebSearchImplementation> = {
    google: 'google_search',
    vertex: 'google_search',
    openai: 'openai_responses',
    anthropic: 'anthropic_server_tool',
    // Future providers:
    // perplexity: 'native',
};

/**
 * Provider Capabilities Registry
 *
 * Defines the capabilities of each supported AI provider.
 * This registry is used for:
 * - UI feature gating (disable unavailable features with tooltips)
 * - Tool routing (use provider-specific implementations)
 * - Backend feature detection
 */
export const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = {
    google: {
        functionCalling: true,
        webSearch: true, // Via google_search built-in tool
        urlContext: true, // Gemini built-in tool
        multimodal: true,
        streaming: true,
        memoryFunctionCalling: true,
    },
    vertex: {
        functionCalling: true,
        webSearch: true, // Via google_search built-in tool
        urlContext: true, // Gemini built-in tool
        multimodal: true,
        streaming: true,
        memoryFunctionCalling: true,
    },
    openai: {
        functionCalling: true, // Supported via Chat Completions API
        webSearch: true, // Supported via Responses API
        urlContext: false, // Not supported - Gemini-specific feature
        multimodal: true,
        streaming: true,
        memoryFunctionCalling: true, // Supported via function calling
    },
    anthropic: {
        functionCalling: true, // Full function calling support
        webSearch: true, // Via web_search_20250305 server tool
        urlContext: false, // Not supported - Gemini-specific feature
        multimodal: true, // Supports images, PDFs
        streaming: true, // Full streaming support
        memoryFunctionCalling: true, // Can use function calling for Supermemory
    },
    // Future providers template:
    // perplexity: {
    //     functionCalling: false,
    //     webSearch: true,         // Built-in web search
    //     urlContext: false,
    //     multimodal: false,
    //     streaming: true,
    //     memoryFunctionCalling: false,
    // },
};

/**
 * Default capabilities for unknown providers
 * Conservative defaults - assume minimal capabilities
 */
const DEFAULT_CAPABILITIES: ProviderCapabilities = {
    functionCalling: false,
    webSearch: false,
    urlContext: false,
    multimodal: false,
    streaming: true, // Most providers support streaming
    memoryFunctionCalling: false,
};

/**
 * Get capabilities for a specific provider
 *
 * @param provider - Provider type identifier (e.g., 'google', 'openai')
 * @returns Provider capabilities object
 *
 * @example
 * const caps = getProviderCapabilities('openai');
 * if (caps.functionCalling) {
 *   // Enable function calling features
 * }
 */
export function getProviderCapabilities(provider: string): ProviderCapabilities {
    return PROVIDER_CAPABILITIES[provider] ?? DEFAULT_CAPABILITIES;
}

/**
 * Check if a provider supports a specific capability
 *
 * @param provider - Provider type identifier
 * @param capability - Capability to check
 * @returns true if the provider supports the capability
 *
 * @example
 * if (hasCapability('openai', 'urlContext')) {
 *   // Won't reach here - OpenAI doesn't support URL context
 * }
 */
export function hasCapability(
    provider: string,
    capability: keyof ProviderCapabilities
): boolean {
    const caps = getProviderCapabilities(provider);
    return caps[capability];
}

/**
 * Get the web search implementation type for a provider
 *
 * @param provider - Provider type identifier
 * @returns Web search implementation type
 *
 * @example
 * const impl = getWebSearchImplementation('google');
 * // Returns 'google_search'
 *
 * const impl = getWebSearchImplementation('openai');
 * // Returns 'openai_responses'
 */
export function getWebSearchImplementation(provider: string): WebSearchImplementation {
    return WEB_SEARCH_IMPLEMENTATIONS[provider] ?? 'none';
}

/**
 * Get all providers that support a specific capability
 *
 * @param capability - Capability to filter by
 * @returns Array of provider names that support the capability
 *
 * @example
 * const urlContextProviders = getProvidersWithCapability('urlContext');
 * // Returns ['google', 'vertex']
 */
export function getProvidersWithCapability(
    capability: keyof ProviderCapabilities
): string[] {
    return Object.entries(PROVIDER_CAPABILITIES)
        .filter(([, caps]) => caps[capability])
        .map(([provider]) => provider);
}

/**
 * Check if any configured provider supports a capability
 * Useful for determining if a feature should be shown at all
 *
 * @param providers - Array of configured provider names
 * @param capability - Capability to check
 * @returns true if at least one provider supports the capability
 */
export function anyProviderHasCapability(
    providers: string[],
    capability: keyof ProviderCapabilities
): boolean {
    return providers.some((provider) => hasCapability(provider, capability));
}
