/**
 * Type definitions for AI Provider configuration
 * Supports Google Generative AI, Vertex AI, and OpenAI providers
 */

export type AIProvider = 'google' | 'vertex' | 'openai' | 'anthropic' | 'xai';

/**
 * Vertex AI service account credentials
 * These are obtained from Google Cloud Console
 */
export interface VertexCredentials {
    projectId: string;
    location: string;
    clientEmail: string;
    privateKey: string;
    privateKeyId?: string;
}

/**
 * Provider configuration
 * Contains provider type and associated credentials
 */
export interface ProviderConfig {
    provider: AIProvider;
    googleApiKey?: string;
    vertexCredentials?: VertexCredentials;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    xaiApiKey?: string;
}

/**
 * Storage schema for provider configuration
 */
export interface ProviderStorageSchema {
    ai_provider_config?: ProviderConfig;
}

