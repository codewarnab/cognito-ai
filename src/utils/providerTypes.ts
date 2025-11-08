/**
 * Type definitions for AI Provider configuration
 * Supports both Google Generative AI and Vertex AI providers
 */

export type AIProvider = 'google' | 'vertex';

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
}

/**
 * Storage schema for provider configuration
 */
export interface ProviderStorageSchema {
    ai_provider_config?: ProviderConfig;
}
