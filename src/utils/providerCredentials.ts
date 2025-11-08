/**
 * Provider Credentials Utility
 * Manages AI provider configuration and credentials storage
 * Supports both Google Generative AI and Vertex AI providers
 */

import { APIError, ErrorType } from '../errors/errorTypes';
import type { AIProvider, ProviderConfig, VertexCredentials } from './providerTypes';
import { createLogger } from '../logger';

const credentialsLog = createLogger('Credentials', 'CREDENTIALS');
const storageLog = createLogger('Credentials-Storage', 'STORAGE');

const STORAGE_KEY = 'ai_provider_config';

/**
 * Validate Vertex AI credentials format
 */
function validateVertexCredentials(credentials: VertexCredentials): { valid: boolean; error?: string } {
    if (!credentials.projectId || credentials.projectId.trim().length === 0) {
        return { valid: false, error: 'Project ID is required' };
    }

    if (!credentials.location || credentials.location.trim().length === 0) {
        return { valid: false, error: 'Location is required' };
    }

    if (!credentials.clientEmail || credentials.clientEmail.trim().length === 0) {
        return { valid: false, error: 'Client email is required' };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(credentials.clientEmail)) {
        return { valid: false, error: 'Client email format is invalid' };
    }

    if (!credentials.privateKey || credentials.privateKey.trim().length === 0) {
        return { valid: false, error: 'Private key is required' };
    }

    // Basic validation of private key format
    if (!credentials.privateKey.includes('BEGIN PRIVATE KEY')) {
        return { valid: false, error: 'Private key format appears invalid. Should contain "BEGIN PRIVATE KEY"' };
    }

    return { valid: true };
}

/**
 * Get provider configuration from storage
 * @returns Provider configuration or null if not set
 */
export async function getProviderConfig(): Promise<ProviderConfig | null> {
    try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        storageLog.debug('Retrieved provider config from storage');
        return result[STORAGE_KEY] || null;
    } catch (error) {
        credentialsLog.error('Failed to get provider config', error);
        return null;
    }
}

/**
 * Set provider configuration in storage
 * @param config Provider configuration to store
 * @throws {APIError} If configuration is invalid
 */
export async function setProviderConfig(config: ProviderConfig): Promise<void> {
    try {
        // Validate based on provider type
        if (config.provider === 'vertex') {
            if (!config.vertexCredentials) {
                throw APIError.authFailed('Vertex credentials are required');
            }
            const validation = validateVertexCredentials(config.vertexCredentials);
            if (!validation.valid) {
                throw APIError.authFailed(validation.error || 'Invalid Vertex credentials');
            }
        } else if (config.provider === 'google') {
            if (!config.googleApiKey) {
                throw APIError.authFailed('Google API key is required');
            }
        }

        await chrome.storage.local.set({ [STORAGE_KEY]: config });
        credentialsLog.info('Provider config saved', { provider: config.provider });
    } catch (error) {
        credentialsLog.error('Failed to set provider config', error);
        throw error;
    }
}

/**
 * Get Vertex AI credentials from storage
 * @returns Vertex credentials or null if not configured
 */
export async function getVertexCredentials(): Promise<VertexCredentials | null> {
    const config = await getProviderConfig();
    return config?.vertexCredentials || null;
}

/**
 * Set Vertex AI credentials
 * @param credentials Vertex credentials to store
 * @throws {APIError} If credentials are invalid
 */
export async function setVertexCredentials(credentials: VertexCredentials): Promise<void> {
    try {
        // Validate credentials
        const validation = validateVertexCredentials(credentials);
        if (!validation.valid) {
            throw APIError.authFailed(validation.error || 'Invalid Vertex credentials');
        }

        // Get existing config or create new one
        const config = await getProviderConfig() || { provider: 'vertex' };

        // Update with Vertex credentials
        config.provider = 'vertex';
        config.vertexCredentials = credentials;

        await setProviderConfig(config);
        credentialsLog.info('Vertex credentials configured');
    } catch (error) {
        credentialsLog.error('Failed to set Vertex credentials', error);
        throw error;
    }
}

/**
 * Check if Vertex AI credentials are configured
 * @returns true if Vertex credentials are set and valid
 */
export async function hasVertexCredentials(): Promise<boolean> {
    const credentials = await getVertexCredentials();
    if (!credentials) return false;

    const validation = validateVertexCredentials(credentials);
    return validation.valid;
}

/**
 * Clear Vertex AI credentials from storage
 */
export async function clearVertexCredentials(): Promise<void> {
    try {
        const config = await getProviderConfig();
        if (config) {
            delete config.vertexCredentials;

            // If no other credentials remain, remove the entire config
            if (!config.googleApiKey) {
                await chrome.storage.local.remove(STORAGE_KEY);
            } else {
                // Switch to Google provider if API key exists
                config.provider = 'google';
                await chrome.storage.local.set({ [STORAGE_KEY]: config });
            }
        }
        credentialsLog.info('Vertex credentials cleared');
    } catch (error) {
        credentialsLog.error('Failed to clear Vertex credentials', error);
        throw error;
    }
}

/**
 * Get Google AI API key from provider config
 * @returns API key or null if not configured
 */
export async function getGoogleApiKey(): Promise<string | null> {
    const config = await getProviderConfig();
    return config?.googleApiKey || null;
}

/**
 * Set Google AI API key
 * @param apiKey Google AI API key to store
 */
export async function setGoogleApiKey(apiKey: string): Promise<void> {
    try {
        if (!apiKey || apiKey.trim().length === 0) {
            throw APIError.authFailed('API key cannot be empty');
        }

        // Get existing config or create new one
        const config = await getProviderConfig() || { provider: 'google' };

        // Update with Google API key
        config.provider = 'google';
        config.googleApiKey = apiKey.trim();

        await setProviderConfig(config);
        credentialsLog.info('Google API key configured');
    } catch (error) {
        credentialsLog.error('Failed to set Google API key', error);
        throw error;
    }
}

/**
 * Check if Google AI API key is configured
 * @returns true if API key is set
 */
export async function hasGoogleApiKey(): Promise<boolean> {
    const config = await getProviderConfig();
    return !!(config?.googleApiKey && config.googleApiKey.trim().length > 0);
}

/**
 * Clear Google AI API key from storage
 */
export async function clearGoogleApiKey(): Promise<void> {
    try {
        const config = await getProviderConfig();
        if (config) {
            delete config.googleApiKey;

            // If no other credentials remain, remove the entire config
            if (!config.vertexCredentials) {
                await chrome.storage.local.remove(STORAGE_KEY);
            } else {
                // Switch to Vertex provider if credentials exist
                config.provider = 'vertex';
                await chrome.storage.local.set({ [STORAGE_KEY]: config });
            }
        }
        credentialsLog.info('Google API key cleared');
    } catch (error) {
        credentialsLog.error('Failed to clear Google API key', error);
        throw error;
    }
}

/**
 * Determine which provider to use
 * Rules:
 * - If user explicitly selected a provider, use it
 * - Otherwise, default to Vertex if both are configured
 * - Use whichever is available if only one is configured
 * @returns Active provider
 * @throws {APIError} If no provider is configured
 */
export async function getActiveProvider(): Promise<AIProvider> {
    const config = await getProviderConfig();

    // If user explicitly selected a provider and it's configured, use it
    if (config?.provider) {
        if (config.provider === 'vertex' && await hasVertexCredentials()) {
            return 'vertex';
        }
        if (config.provider === 'google' && await hasGoogleApiKey()) {
            return 'google';
        }
    }

    // Otherwise, determine based on what's configured
    const hasVertex = await hasVertexCredentials();
    const hasGoogle = await hasGoogleApiKey();

    // Default to Vertex if both are configured
    if (hasVertex && hasGoogle) {
        return 'vertex';
    } else if (hasVertex) {
        return 'vertex';
    } else if (hasGoogle) {
        return 'google';
    }

    // No credentials configured
    throw new APIError({
        message: 'No AI provider configured',
        statusCode: 401,
        retryable: false,
        userMessage: 'Please configure an AI provider (Google AI or Vertex AI) to use the assistant.',
        technicalDetails: 'No provider credentials found in storage',
        errorCode: ErrorType.API_AUTH_FAILED,
    });
}

/**
 * Get instructions for configuring a provider
 * @param provider Provider to get instructions for
 * @returns Instruction text
 */
export function getProviderInstructions(provider: AIProvider): string {
    if (provider === 'google') {
        return `
**How to get a Google AI API key:**

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key" or "Get API Key"
4. Copy the generated key
5. Paste it in the API Key field below

**Note:** The free tier includes generous quotas for personal use.
        `.trim();
    } else {
        return `
**How to get Vertex AI credentials:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "IAM & Admin" → "Service Accounts"
3. Create a new service account or select an existing one
4. Grant the "Vertex AI User" role to the service account
5. Click "Create Key" and select JSON format
6. Download the JSON file
7. Copy the values from the JSON file to the fields below:
   - **Project ID**: "project_id" field
   - **Client Email**: "client_email" field
   - **Private Key**: "private_key" field (entire value including BEGIN/END markers)
   - **Private Key ID**: "private_key_id" field (optional)
8. For **Location**, use your preferred region (default: us-central1)

**Note:** Ensure your GCP project has the Vertex AI API enabled.
        `.trim();
    }
}

/**
 * Check if any provider is configured
 * @returns true if at least one provider is configured
 */
export async function hasAnyProviderConfigured(): Promise<boolean> {
    const hasVertex = await hasVertexCredentials();
    const hasGoogle = await hasGoogleApiKey();
    return hasVertex || hasGoogle;
}

/**
 * Get the currently selected provider (without checking if it's configured)
 * @returns Selected provider or null if not set
 */
export async function getSelectedProvider(): Promise<AIProvider | null> {
    const config = await getProviderConfig();
    return config?.provider || null;
}

/**
 * Set the selected provider (without changing credentials)
 * @param provider Provider to select
 */
export async function setSelectedProvider(provider: AIProvider): Promise<void> {
    const config = await getProviderConfig() || { provider };
    config.provider = provider;
    await chrome.storage.local.set({ [STORAGE_KEY]: config });
}

/**
 * Mark Vertex credentials as invalid in cache
 * Used when authentication fails
 * @param reason Reason for marking invalid
 */
export async function markVertexCredentialsInvalid(reason: string): Promise<void> {
    credentialsLog.warn('Vertex credentials marked as invalid:', reason);
    // We could implement a cache invalidation mechanism here
    // For now, just log the reason
    // In the future, could add a validation cache similar to geminiApiKey.ts
}

/**
 * Mark Google API key as invalid in cache  
 * Used when authentication fails
 * @param reason Reason for marking invalid
 */
export async function markGoogleApiKeyInvalid(reason: string): Promise<void> {
    credentialsLog.warn('Google API key marked as invalid:', reason);
    // We could implement a cache invalidation mechanism here
    // For now, just log the reason
}
