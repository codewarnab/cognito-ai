/**
 * @cognito/shared - Provider Types
 * AI provider configuration types shared between extension and webapp
 */

/**
 * Supported AI providers
 */
export type AIProvider = 'google' | 'vertex' | 'openai' | 'anthropic' | 'xai';

/**
 * Vertex AI service account credentials
 * These are obtained from Google Cloud Console
 */
export interface VertexCredentials {
    /** Google Cloud project ID */
    projectId: string;
    /** GCP region (e.g., 'us-central1') */
    location: string;
    /** Service account email address */
    clientEmail: string;
    /** Private key (PEM format) */
    privateKey: string;
    /** Private key ID (optional) */
    privateKeyId?: string;
}

/**
 * Provider configuration stored in chrome.storage.local
 */
export interface ProviderConfig {
    /** Currently selected provider */
    provider: AIProvider;
    /** Google AI Studio API key */
    googleApiKey?: string;
    /** Vertex AI service account credentials */
    vertexCredentials?: VertexCredentials;
    /** OpenAI API key */
    openaiApiKey?: string;
    /** Anthropic API key */
    anthropicApiKey?: string;
    /** xAI (Grok) API key */
    xaiApiKey?: string;
}

