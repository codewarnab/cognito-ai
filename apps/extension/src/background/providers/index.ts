/**
 * Provider Factory
 * Creates and returns the appropriate provider based on active configuration
 */

import { getActiveProvider } from '@/utils/credentials';
import type { IProvider } from './types';
import { GoogleProvider } from './google';
import { VertexProvider } from './vertex';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { XAIProvider } from './xai';
import { createLogger } from '~logger';
import type { AIProvider } from '@/utils/credentials/providerTypes';

const log = createLogger('ProviderFactory', 'BACKGROUND');

// Re-export types for consumers
export type {
    IProvider,
    ProviderConfig,
    GenerationOptions,
    BaseRequestBody,
    ProviderTool,
    ToolCall,
    ToolResult,
    Message,
    StreamChunk,
    ProviderFactory,
} from './types';

// Re-export capability system
export {
    getProviderCapabilities,
    hasCapability,
    getWebSearchImplementation,
    getProvidersWithCapability,
    anyProviderHasCapability,
    PROVIDER_CAPABILITIES,
    WEB_SEARCH_IMPLEMENTATIONS,
} from './capabilities';
export type { ProviderCapabilities, WebSearchImplementation } from './capabilities';

// Re-export OpenAI web search module
export {
    searchWithOpenAI,
    isOpenAIWebSearchAvailable,
    formatCitationsForPrompt,
} from './openai/webSearch';
export type {
    WebSearchResult as OpenAIWebSearchResult,
    WebSearchCitation as OpenAIWebSearchCitation,
    OpenAIWebSearchOptions,
} from './openai/webSearch';

// Re-export unified web search abstraction
export {
    performWebSearch,
    enrichPromptWithSearch,
    isWebSearchAvailable,
} from './webSearch';
export type {
    WebSearchResult,
    WebSearchCitation,
    WebSearchRouteResult,
    WebSearchOptions,
} from './webSearch';

/**
 * Cached provider instances
 * We cache instances to avoid recreating them on every call
 */
const providerCache: Map<string, IProvider> = new Map();

/**
 * Get a provider instance for the specified type
 * Uses cached instances when available
 */
function getProviderByType(type: AIProvider): IProvider {
    const cached = providerCache.get(type);
    if (cached) {
        return cached;
    }

    let provider: IProvider;

    switch (type) {
        case 'google':
            provider = new GoogleProvider();
            break;
        case 'vertex':
            provider = new VertexProvider();
            break;
        case 'openai':
            provider = new OpenAIProvider();
            break;
        case 'anthropic':
            provider = new AnthropicProvider();
            break;
        case 'xai':
            provider = new XAIProvider();
            break;
        default:
            throw new Error(`Unsupported provider type: ${type}`);
    }

    providerCache.set(type, provider);
    return provider;
}

/**
 * Get the active provider based on user configuration
 * Automatically selects the correct provider based on stored credentials
 * 
 * @returns The active provider instance
 * @throws Error if no provider is configured
 */
export async function getProvider(): Promise<IProvider> {
    const activeProviderType = await getActiveProvider();
    log.debug('Getting provider', { type: activeProviderType });
    return getProviderByType(activeProviderType);
}

/**
 * Get a specific provider by type
 * Useful when you need a specific provider regardless of active configuration
 * 
 * @param type Provider type to get
 * @returns The requested provider instance
 */
export function getSpecificProvider(type: AIProvider): IProvider {
    return getProviderByType(type);
}

/**
 * Clear the provider cache
 * Useful when credentials change and we need fresh instances
 */
export function clearProviderCache(): void {
    providerCache.clear();
    log.debug('Provider cache cleared');
}

/**
 * Execute a streaming request using the active provider
 * Handles the SSE stream parsing for all providers
 * 
 * @param systemPrompt System/instruction prompt
 * @param userPrompt User prompt
 * @param options Generation options
 * @yields Text chunks from the stream
 */
export async function* streamWithProvider(
    systemPrompt: string,
    userPrompt: string,
    options: { maxTokens: number; temperature?: number; topP?: number }
): AsyncGenerator<string, void, unknown> {
    const provider = await getProvider();
    const config = await provider.getConfig(true);

    const body = provider.buildRequestBody(systemPrompt, userPrompt, {
        ...options,
        stream: true,
    });

    log.debug('Starting stream', {
        provider: provider.type,
        model: config.modelName,
    });

    const response = await fetch(config.url, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        log.error('API error', { status: response.status, provider: provider.type, error: errorText });
        throw new Error(`${provider.type} API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data && data !== '[DONE]') {
                        const text = provider.parseStreamChunk(data);
                        if (text) yield text;
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * Execute a non-streaming request using the active provider
 * 
 * @param systemPrompt System/instruction prompt
 * @param userPrompt User prompt
 * @param options Generation options
 * @returns Generated text
 */
export async function generateWithProvider(
    systemPrompt: string,
    userPrompt: string,
    options: { maxTokens: number; temperature?: number; topP?: number }
): Promise<string> {
    const provider = await getProvider();
    const config = await provider.getConfig(false);

    const body = provider.buildRequestBody(systemPrompt, userPrompt, {
        ...options,
        stream: false,
    });

    log.debug('Generating text', {
        provider: provider.type,
        model: config.modelName,
    });

    const response = await fetch(config.url, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        log.error('API error', { status: response.status, provider: provider.type, error: errorText });
        throw new Error(`${provider.type} API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return provider.parseResponse(data);
}
