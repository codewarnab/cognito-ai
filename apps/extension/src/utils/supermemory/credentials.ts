/**
 * Supermemory Credentials Management
 * Handles storage and retrieval of Supermemory API key and enabled state.
 */

import { createLogger } from '~logger';

const log = createLogger('SupermemoryCredentials', 'UTILS');

const API_KEY_STORAGE_KEY = 'supermemory:apiKey';
const ENABLED_STORAGE_KEY = 'supermemory:enabled';

/**
 * Retrieves the stored Supermemory API key.
 * 
 * @returns Promise<string | null> - The API key or null if not configured
 */
export async function getSupermemoryApiKey(): Promise<string | null> {
    try {
        const storage = await chrome.storage.local.get(API_KEY_STORAGE_KEY);
        return storage[API_KEY_STORAGE_KEY] || null;
    } catch (error) {
        log.error('Failed to retrieve Supermemory API key', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return null;
    }
}

/**
 * Stores the Supermemory API key.
 * 
 * @param apiKey - The API key to store
 * @returns Promise<void>
 */
export async function setSupermemoryApiKey(apiKey: string): Promise<void> {
    try {
        await chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: apiKey });
        log.info('Supermemory API key saved');
    } catch (error) {
        log.error('Failed to save Supermemory API key', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
}

/**
 * Removes the stored Supermemory API key.
 * 
 * @returns Promise<void>
 */
export async function clearSupermemoryApiKey(): Promise<void> {
    try {
        await chrome.storage.local.remove(API_KEY_STORAGE_KEY);
        log.info('Supermemory API key cleared');
    } catch (error) {
        log.error('Failed to clear Supermemory API key', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
}

/**
 * Checks if a Supermemory API key is configured.
 * 
 * @returns Promise<boolean> - True if API key exists and is non-empty
 */
export async function hasSupermemoryApiKey(): Promise<boolean> {
    const apiKey = await getSupermemoryApiKey();
    return !!apiKey && apiKey.trim().length > 0;
}

/**
 * Checks if Supermemory is enabled by the user.
 * 
 * @returns Promise<boolean> - True if Supermemory is enabled
 */
export async function isSupermemoryEnabled(): Promise<boolean> {
    try {
        const storage = await chrome.storage.local.get(ENABLED_STORAGE_KEY);
        return storage[ENABLED_STORAGE_KEY] === true;
    } catch (error) {
        log.error('Failed to check Supermemory enabled state', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return false;
    }
}

/**
 * Sets the Supermemory enabled state.
 * 
 * @param enabled - Whether Supermemory should be enabled
 * @returns Promise<void>
 */
export async function setSupermemoryEnabled(enabled: boolean): Promise<void> {
    try {
        await chrome.storage.local.set({ [ENABLED_STORAGE_KEY]: enabled });
        log.info('Supermemory enabled state updated', { enabled });
    } catch (error) {
        log.error('Failed to update Supermemory enabled state', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
}

/**
 * Checks if Supermemory is fully configured and ready to use.
 * Requires both an API key and the enabled flag to be true.
 * 
 * @returns Promise<boolean> - True if Supermemory is configured and enabled
 */
export async function isSupermemoryReady(): Promise<boolean> {
    const [hasKey, enabled] = await Promise.all([
        hasSupermemoryApiKey(),
        isSupermemoryEnabled()
    ]);
    return hasKey && enabled;
}

/**
 * Validates a Supermemory API key format.
 * Basic validation - checks for non-empty string with reasonable length.
 * 
 * @param apiKey - The API key to validate
 * @returns boolean - True if the API key format appears valid
 */
export function validateSupermemoryApiKeyFormat(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
        return false;
    }

    const trimmed = apiKey.trim();
    // API keys are typically at least 20 characters
    return trimmed.length >= 20;
}
