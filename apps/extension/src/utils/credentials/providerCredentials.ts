/**
 * Provider Credentials Utility
 * Manages AI provider configuration and credentials storage
 * 
 * REFACTORED: Now uses exclusively the new `providersConfig` storage via providerService.
 * The old `ai_provider_config` storage key is NO LONGER USED.
 */

import { APIError, ErrorType } from '@/errors/errorTypes';
import type { AIProvider, VertexCredentials } from './providerTypes';
import { getProvidersConfig } from '@/services/providerService';
import type { AIProviderConfig, ConfigProvider, SpecialProvider } from '@cognito/shared/types';
import { createLogger } from '~logger';

const credentialsLog = createLogger('Credentials', 'CREDENTIALS_AUTH');

/**
 * Find a provider in the config by its name
 */
function findProvider(config: AIProviderConfig | undefined, providerName: string): ConfigProvider | undefined {
    if (!config?.providers) return undefined;
    return config.providers.find(p => p.name === providerName);
}

/**
 * Check if a provider is enabled and has an API key
 */
function isProviderConfigured(provider: ConfigProvider | undefined): boolean {
    if (!provider || !provider.enabled) return false;

    // Check for API key (standard providers)
    if ('api_key' in provider && provider.api_key && provider.api_key.trim().length > 0) {
        return true;
    }

    // Check for custom_fields (special providers like Vertex)
    if ('custom_fields' in provider) {
        const special = provider as SpecialProvider;
        if (special.custom_fields?.clientEmail && special.custom_fields?.privateKey) {
            return true;
        }
    }

    return false;
}

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

// ============================================================================
// API Key Retrieval - All from providersConfig now
// ============================================================================

/**
 * Get Google AI API key from providersConfig
 * @returns API key or null if not configured
 */
export async function getGoogleApiKey(): Promise<string | null> {
    try {
        const config = await getProvidersConfig();
        const provider = findProvider(config, 'google_gemini');
        if (provider && 'api_key' in provider && provider.api_key) {
            return provider.api_key;
        }
        return null;
    } catch (error) {
        credentialsLog.error('Failed to get Google API key', error);
        return null;
    }
}

/**
 * Check if Google AI API key is configured
 * @returns true if API key is set
 */
export async function hasGoogleApiKey(): Promise<boolean> {
    const config = await getProvidersConfig();
    const provider = findProvider(config, 'google_gemini');
    return isProviderConfigured(provider);
}

/**
 * Get OpenAI API key from providersConfig
 * @returns API key or null if not configured
 */
export async function getOpenAIApiKey(): Promise<string | null> {
    try {
        const config = await getProvidersConfig();
        const provider = findProvider(config, 'openai');
        if (provider && 'api_key' in provider && provider.api_key) {
            return provider.api_key;
        }
        return null;
    } catch (error) {
        credentialsLog.error('Failed to get OpenAI API key', error);
        return null;
    }
}

/**
 * Check if OpenAI API key is configured
 * @returns true if API key is set
 */
export async function hasOpenAIApiKey(): Promise<boolean> {
    const config = await getProvidersConfig();
    const provider = findProvider(config, 'openai');
    return isProviderConfigured(provider);
}

/**
 * Get Anthropic API key from providersConfig
 * @returns API key or null if not configured
 */
export async function getAnthropicApiKey(): Promise<string | null> {
    try {
        const config = await getProvidersConfig();
        const provider = findProvider(config, 'anthropic');
        if (provider && 'api_key' in provider && provider.api_key) {
            return provider.api_key;
        }
        return null;
    } catch (error) {
        credentialsLog.error('Failed to get Anthropic API key', error);
        return null;
    }
}

/**
 * Check if Anthropic API key is configured
 * @returns true if API key is set
 */
export async function hasAnthropicApiKey(): Promise<boolean> {
    const config = await getProvidersConfig();
    const provider = findProvider(config, 'anthropic');
    return isProviderConfigured(provider);
}

/**
 * Get xAI API key from providersConfig
 * @returns API key or null if not configured
 */
export async function getXaiApiKey(): Promise<string | null> {
    try {
        const config = await getProvidersConfig();
        const provider = findProvider(config, 'xai');
        if (provider && 'api_key' in provider && provider.api_key) {
            return provider.api_key;
        }
        return null;
    } catch (error) {
        credentialsLog.error('Failed to get xAI API key', error);
        return null;
    }
}

/**
 * Check if xAI API key is configured
 * @returns true if API key is set
 */
export async function hasXaiApiKey(): Promise<boolean> {
    const config = await getProvidersConfig();
    const provider = findProvider(config, 'xai');
    return isProviderConfigured(provider);
}

// ============================================================================
// Vertex AI Credentials - from providersConfig custom_fields
// ============================================================================

/**
 * Get Vertex AI credentials from providersConfig
 * @returns Vertex credentials or null if not configured
 */
export async function getVertexCredentials(): Promise<VertexCredentials | null> {
    try {
        const config = await getProvidersConfig();
        const provider = findProvider(config, 'vertex') as SpecialProvider | undefined;

        if (!provider || !provider.custom_fields) return null;

        const fields = provider.custom_fields;
        if (!fields.clientEmail || !fields.privateKey || !fields.projectId) {
            return null;
        }

        return {
            projectId: fields.projectId,
            location: fields.location || 'us-central1',
            clientEmail: fields.clientEmail,
            privateKey: fields.privateKey,
            privateKeyId: fields.privateKeyId,
        };
    } catch (error) {
        credentialsLog.error('Failed to get Vertex credentials', error);
        return null;
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

// ============================================================================
// Active Provider Selection
// ============================================================================

/**
 * Determine which provider to use based on what's configured
 * Checks providers in priority order and returns the first one that's enabled and has credentials
 * @returns Active provider
 * @throws {APIError} If no provider is configured
 */
export async function getActiveProvider(): Promise<AIProvider> {
    // Import here to avoid circular dependency
    const { PROVIDER_PRIORITY } = await import('~/constants/providerPriority');

    const providerChecks: Record<string, () => Promise<boolean>> = {
        'openai': hasOpenAIApiKey,
        'google': hasGoogleApiKey,
        'vertex': hasVertexCredentials,
        'anthropic': hasAnthropicApiKey,
        'xai': hasXaiApiKey,
    };

    for (const provider of PROVIDER_PRIORITY) {
        const checkFn = providerChecks[provider];
        if (checkFn && await checkFn()) {
            credentialsLog.info('Active provider determined', { provider });
            return provider as AIProvider;
        }
    }

    // No credentials configured
    throw new APIError({
        message: 'No AI provider configured',
        statusCode: 401,
        retryable: false,
        userMessage: 'Please configure an AI provider in the Settings → AI Providers page.',
        technicalDetails: 'No provider credentials found in providersConfig',
        errorCode: ErrorType.API_AUTH_FAILED,
    });
}

/**
 * Check if any provider is configured
 * @returns true if at least one provider is configured
 */
export async function hasAnyProviderConfigured(): Promise<boolean> {
    const hasVertex = await hasVertexCredentials();
    const hasGoogle = await hasGoogleApiKey();
    const hasOpenAI = await hasOpenAIApiKey();
    const hasAnthropic = await hasAnthropicApiKey();
    const hasXai = await hasXaiApiKey();
    return hasVertex || hasGoogle || hasOpenAI || hasAnthropic || hasXai;
}

// ============================================================================
// Provider Instructions (unchanged)
// ============================================================================

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
    } else if (provider === 'vertex') {
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
    } else if (provider === 'xai') {
        return `
**How to get an xAI API Key:**

1. Visit [xAI Console](https://console.x.ai/)
2. Sign up or log in to your account
3. Navigate to the API Keys section
4. Create a new API Key
5. Copy the key and paste it below

**Note:** xAI offers generous free credits for new users.
        `.trim();
    } else {
        return `Please configure your ${provider} API key in the AI Providers settings.`;
    }
}

// ============================================================================
// Cache Invalidation Markers (kept for compatibility, now no-ops)
// ============================================================================

export async function markVertexCredentialsInvalid(reason: string): Promise<void> {
    credentialsLog.warn('Vertex credentials marked as invalid:', reason);
}

export async function markGoogleApiKeyInvalid(reason: string): Promise<void> {
    credentialsLog.warn('Google API key marked as invalid:', reason);
}

export async function markGoogleApiKeyValid(): Promise<void> {
    credentialsLog.debug('Google API key marked as valid');
}
