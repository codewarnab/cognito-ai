/**
 * AI Model configuration types
 */

export type ModelProvider = 'chrome-ai' | 'openai' | 'anthropic' | 'custom';

export type ModelAvailability = 'readily' | 'after-download' | 'no';

export interface ModelCapabilities {
    available: ModelAvailability;
    defaultTemperature?: number;
    defaultTopK?: number;
    maxTopK?: number;
    maxTokens?: number;
}

export interface ModelConfiguration {
    provider: ModelProvider;
    modelId: string;
    temperature?: number;
    topK?: number;
    maxTokens?: number;
    systemPrompt?: string;
}

export interface ModelDownloadProgress {
    loaded: number;
    total: number;
    percentage: number;
}

export type ModelDownloadCallback = (progress: ModelDownloadProgress) => void;

export interface ModelOptions {
    temperature?: number;
    topK?: number;
    systemPrompt?: string;
    monitor?: ModelDownloadCallback;
    signal?: AbortSignal;
}
