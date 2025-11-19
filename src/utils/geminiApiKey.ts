/**
 * Utility functions for managing Gemini API key in chrome.storage.local
 * Includes validation and error handling
 * 
 * @deprecated Legacy storage - New code should use providerCredentials.ts
 * This file is kept for backward compatibility with existing code references
 */

import { APIError, ErrorType } from '../errors/errorTypes';
import { createLogger } from '~logger';

const credentialsLog = createLogger('Credentials-Legacy', 'CREDENTIALS');
const storageLog = createLogger('Storage-Legacy', 'STORAGE');

const STORAGE_KEY = 'gemini_api_key';
const VALIDATION_CACHE_KEY = 'gemini_api_key_validation';
const CACHE_DURATION_MS = 3600000; // 1 hour

/**
 * Validation result cache
 */
interface ValidationCache {
    isValid: boolean;
    timestamp: number;
    errorCode?: string;
}

/**
 * Validate API key format
 * Gemini API keys typically start with "AIza" and are around 39 characters
 */
function validateApiKeyFormat(apiKey: string): { valid: boolean; error?: string } {
    if (!apiKey || apiKey.trim().length === 0) {
        return { valid: false, error: 'API key is empty' };
    }

    const trimmedKey = apiKey.trim();

    // Basic length check
    if (trimmedKey.length < 20) {
        return { valid: false, error: 'API key is too short' };
    }

    // Check for common patterns (Gemini keys usually start with "AIza")
    if (!trimmedKey.startsWith('AIza')) {
        credentialsLog.warn('API key format may be invalid - expected to start with "AIza"');
    }

    // Check for suspicious characters (API keys should be alphanumeric with some symbols)
    if (!/^[A-Za-z0-9_.\-]+$/.test(trimmedKey)) {
        return { valid: false, error: 'API key contains invalid characters' };
    }

    return { valid: true };
}

/**
 * Get cached validation result
 */
async function getCachedValidation(): Promise<ValidationCache | null> {
    try {
        const result = await chrome.storage.local.get(VALIDATION_CACHE_KEY);
        const cached = result[VALIDATION_CACHE_KEY] as ValidationCache | undefined;

        if (!cached) return null;

        // Check if cache is still valid
        const age = Date.now() - cached.timestamp;
        if (age > CACHE_DURATION_MS) {
            return null;
        }

        return cached;
    } catch (error) {
        storageLog.error('Failed to get cached validation', error);
        return null;
    }
}

/**
 * Set validation cache
 */
async function setCachedValidation(isValid: boolean, errorCode?: string): Promise<void> {
    try {
        const cache: ValidationCache = {
            isValid,
            timestamp: Date.now(),
            errorCode,
        };
        await chrome.storage.local.set({ [VALIDATION_CACHE_KEY]: cache });
    } catch (error) {
        storageLog.error('Failed to set validation cache', error);
    }
}

/**
 * Clear validation cache
 */
async function clearValidationCache(): Promise<void> {
    try {
        await chrome.storage.local.remove(VALIDATION_CACHE_KEY);
    } catch (error) {
        storageLog.error('Failed to clear validation cache', error);
    }
}

/**
 * Get the stored Gemini API key
 * Checks both old storage (gemini_api_key) and new provider config
 * @returns The API key if set, null otherwise
 */
export async function getGeminiApiKey(): Promise<string | null> {
    try {
        // First check old storage location (backward compatibility)
        const oldResult = await chrome.storage.local.get(STORAGE_KEY);
        if (oldResult[STORAGE_KEY]) {
            return oldResult[STORAGE_KEY];
        }

        // Then check new provider config location
        const newResult = await chrome.storage.local.get('ai_provider_config');
        if (newResult.ai_provider_config?.googleApiKey) {
            return newResult.ai_provider_config.googleApiKey;
        }

        return null;
    } catch (error) {
        credentialsLog.error('Failed to get Gemini API key', error);
        return null;
    }
}

/**
 * Set the Gemini API key
 * Validates format before storing
 * @param apiKey The API key to store
 * @throws {APIError} If API key format is invalid
 */
export async function setGeminiApiKey(apiKey: string): Promise<void> {
    try {
        // Validate format
        const validation = validateApiKeyFormat(apiKey);
        if (!validation.valid) {
            throw APIError.authFailed(validation.error || 'Invalid API key format');
        }

        // Store the key
        await chrome.storage.local.set({ [STORAGE_KEY]: apiKey.trim() });

        // Clear validation cache when key changes
        await clearValidationCache();
    } catch (error) {
        credentialsLog.error('Failed to set Gemini API key', error);
        throw error;
    }
}

/**
 * Remove the stored Gemini API key
 */
export async function removeGeminiApiKey(): Promise<void> {
    try {
        await chrome.storage.local.remove(STORAGE_KEY);
        await clearValidationCache();
    } catch (error) {
        credentialsLog.error('Failed to remove Gemini API key', error);
        throw error;
    }
}

/**
 * Check if a Gemini API key is configured
 * @returns true if an API key is set, false otherwise
 */
export async function hasGeminiApiKey(): Promise<boolean> {
    const apiKey = await getGeminiApiKey();
    return apiKey !== null && apiKey.trim().length > 0;
}

/**
 * Validate API key format (does not check with API)
 * @returns Validation result with error message if invalid
 */
export async function validateApiKey(): Promise<{ valid: boolean; error?: string }> {
    const apiKey = await getGeminiApiKey();

    if (!apiKey) {
        return { valid: false, error: 'No API key configured' };
    }

    return validateApiKeyFormat(apiKey);
}

/**
 * Check if API key has been validated recently
 * Uses cache to avoid repeated validation
 */
export async function isApiKeyValidated(): Promise<boolean> {
    const cached = await getCachedValidation();
    return cached?.isValid ?? false;
}

/**
 * Mark API key as invalid (e.g., after 401 response)
 * This will prevent further API calls until key is updated
 */
export async function markApiKeyInvalid(errorCode: string = 'AUTH_FAILED'): Promise<void> {
    await setCachedValidation(false, errorCode);
}

/**
 * Mark API key as valid (e.g., after successful API call)
 */
export async function markApiKeyValid(): Promise<void> {
    await setCachedValidation(true);
}

/**
 * Get instructions for obtaining an API key
 */
export function getApiKeyInstructions(): string {
    return `
**How to get a Gemini API key:**

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key" or "Get API Key"
4. Copy the generated key
5. Return here and paste it in the API Key field

**Note:** The free tier includes generous quotas for personal use.
    `.trim();
}

/**
 * Validate API key and provide user-friendly error messages
 * @throws {APIError} If validation fails
 */
export async function validateAndGetApiKey(): Promise<string> {
    const apiKey = await getGeminiApiKey();

    if (!apiKey) {
        throw new APIError({
            message: 'No API key configured',
            statusCode: 401,
            retryable: false,
            userMessage: 'Please configure your Gemini API key to use the AI assistant.',
            technicalDetails: 'No API key found in storage. User needs to add API key in settings.',
            errorCode: ErrorType.API_AUTH_FAILED,
            metadata: { instructions: getApiKeyInstructions() },
        });
    }

    // Check format
    const validation = validateApiKeyFormat(apiKey);
    if (!validation.valid) {
        throw new APIError({
            message: 'Invalid API key format',
            statusCode: 401,
            retryable: false,
            userMessage: 'The configured API key appears to be invalid.',
            technicalDetails: validation.error || 'API key format validation failed',
            errorCode: ErrorType.API_AUTH_FAILED,
            metadata: { instructions: getApiKeyInstructions() },
        });
    }

    // Check validation cache
    const cached = await getCachedValidation();
    if (cached && !cached.isValid) {
        throw new APIError({
            message: 'API key previously failed validation',
            statusCode: 401,
            retryable: false,
            userMessage: 'Your API key appears to be invalid or expired. Please check and update it.',
            technicalDetails: `API key was marked invalid with code: ${cached.errorCode}`,
            errorCode: ErrorType.API_AUTH_FAILED,
            metadata: {
                instructions: getApiKeyInstructions(),
                cachedErrorCode: cached.errorCode,
            },
        });
    }

    return apiKey;
}

