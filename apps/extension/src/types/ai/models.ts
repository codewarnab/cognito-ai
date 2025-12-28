/**
 * AI Model configuration types
 * 
 * Defines types for model providers, capabilities, and configuration
 * used across the extension's AI features.
 */

/** Supported AI model providers */
export type ModelProvider = 'chrome-ai' | 'openai' | 'anthropic' | 'custom';

/** Model availability status from Chrome AI APIs */
export type ModelAvailability = 'readily' | 'after-download' | 'no';

/**
 * Capabilities reported by an AI model
 * Used to determine what features are available
 */
export interface ModelCapabilities {
    /** Whether the model is available for use */
    available: ModelAvailability;
    /** Default temperature if not specified */
    defaultTemperature?: number;
    /** Default top-K sampling value */
    defaultTopK?: number;
    /** Maximum allowed top-K value */
    maxTopK?: number;
    /** Maximum tokens the model can handle */
    maxTokens?: number;
}

/**
 * Configuration for initializing an AI model
 */
export interface ModelConfiguration {
    /** The provider hosting the model */
    provider: ModelProvider;
    /** Unique identifier for the model */
    modelId: string;
    /** Sampling temperature (0-1, higher = more creative) */
    temperature?: number;
    /** Top-K sampling parameter */
    topK?: number;
    /** Maximum tokens to generate */
    maxTokens?: number;
    /** System prompt to set model behavior */
    systemPrompt?: string;
}

/**
 * Progress information during model download
 */
export interface ModelDownloadProgress {
    /** Bytes downloaded so far */
    loaded: number;
    /** Total bytes to download */
    total: number;
    /** Download progress as percentage (0-100) */
    percentage: number;
}

/** Callback function for model download progress updates */
export type ModelDownloadCallback = (progress: ModelDownloadProgress) => void;

/**
 * Options for model inference requests
 */
export interface ModelOptions {
    /** Sampling temperature (0-1) */
    temperature?: number;
    /** Top-K sampling parameter */
    topK?: number;
    /** System prompt for the session */
    systemPrompt?: string;
    /** Callback for download progress (if model needs downloading) */
    monitor?: ModelDownloadCallback;
    /** AbortSignal for cancellation */
    signal?: AbortSignal;
}
