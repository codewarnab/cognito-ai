/**
 * Provider Capabilities Hook
 *
 * React hook to check provider capabilities from content scripts.
 * Used for UI feature gating - disable unavailable features with tooltips.
 *
 * @example
 * const { capabilities, isLoading } = useProviderCapabilities();
 *
 * if (!capabilities?.urlContext) {
 *   // Disable URL context toggle
 * }
 */

import { useState, useEffect } from 'react';
import { trySendMessage } from '@/lib/messaging';

/**
 * Provider capabilities interface
 * Mirrors the interface in background/providers/capabilities.ts
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
 * Provider capabilities state
 */
export interface ProviderCapabilitiesState {
    /** Current provider type (e.g., 'google', 'openai', 'vertex') */
    provider: string | null;

    /** Provider capabilities object */
    capabilities: ProviderCapabilities | null;

    /** Whether capabilities are still loading */
    isLoading: boolean;

    /** Error message if loading failed */
    error: string | null;
}

/**
 * Hook to fetch and track provider capabilities
 *
 * @returns Provider capabilities state with loading and error states
 *
 * @example
 * const { provider, capabilities, isLoading } = useProviderCapabilities();
 *
 * if (isLoading) return <Spinner />;
 *
 * const urlContextAvailable = capabilities?.urlContext ?? false;
 * const webSearchAvailable = capabilities?.webSearch ?? false;
 */
export function useProviderCapabilities(): ProviderCapabilitiesState {
    const [state, setState] = useState<ProviderCapabilitiesState>({
        provider: null,
        capabilities: null,
        isLoading: true,
        error: null,
    });

    useEffect(() => {
        let mounted = true;

        async function loadCapabilities() {
            try {
                const response = await trySendMessage('GET_PROVIDER_CAPABILITIES');

                if (!mounted) return;

                if (response) {
                    setState({
                        provider: response.provider,
                        capabilities: response.capabilities,
                        isLoading: false,
                        error: null,
                    });
                } else {
                    // Message failed - likely no background script connection
                    setState({
                        provider: null,
                        capabilities: null,
                        isLoading: false,
                        error: 'Failed to connect to background script',
                    });
                }
            } catch (error) {
                if (!mounted) return;

                setState({
                    provider: null,
                    capabilities: null,
                    isLoading: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        void loadCapabilities();

        return () => {
            mounted = false;
        };
    }, []);

    return state;
}

/**
 * Check if a specific capability is available
 *
 * @param capability - Capability to check
 * @returns Object with the capability availability and loading state
 *
 * @example
 * const { available, isLoading } = useCapability('urlContext');
 *
 * if (isLoading) return <Spinner />;
 * if (!available) return <DisabledToggle />;
 */
export function useCapability(
    capability: keyof ProviderCapabilities
): { available: boolean; isLoading: boolean } {
    const { capabilities, isLoading } = useProviderCapabilities();

    return {
        available: capabilities?.[capability] ?? false,
        isLoading,
    };
}

/**
 * Get user-friendly reason why a capability is unavailable
 *
 * @param provider - Current provider type
 * @param capability - Capability that is unavailable
 * @returns User-friendly message explaining why the feature is unavailable
 */
export function getCapabilityUnavailableReason(
    provider: string | null,
    capability: keyof ProviderCapabilities
): string {
    if (!provider) {
        return 'No AI provider configured. Please set up your API keys.';
    }

    switch (capability) {
        case 'urlContext':
            if (provider === 'openai' || provider === 'anthropic') {
                return 'URL context requires Google AI or Vertex AI. This feature is not available for your current provider.';
            }
            return `URL context is not available for ${provider} provider.`;

        case 'webSearch':
            return `Web search is not available for ${provider} provider.`;

        case 'functionCalling':
            return `Function calling is not available for ${provider} provider.`;

        case 'multimodal':
            return `Image and document processing is not available for ${provider} provider.`;

        case 'memoryFunctionCalling':
            return `Memory search is not available for ${provider} provider.`;

        default:
            return `This feature is not available for ${provider} provider.`;
    }
}
