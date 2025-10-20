/**
 * Utility functions for managing Gemini API key in chrome.storage.local
 */

const STORAGE_KEY = 'gemini_api_key';

/**
 * Get the stored Gemini API key
 * @returns The API key if set, null otherwise
 */
export async function getGeminiApiKey(): Promise<string | null> {
    try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        return result[STORAGE_KEY] || null;
    } catch (error) {
        console.error('Failed to get Gemini API key', error);
        return null;
    }
}

/**
 * Set the Gemini API key
 * @param apiKey The API key to store
 */
export async function setGeminiApiKey(apiKey: string): Promise<void> {
    try {
        await chrome.storage.local.set({ [STORAGE_KEY]: apiKey });
    } catch (error) {
        console.error('Failed to set Gemini API key', error);
        throw error;
    }
}

/**
 * Remove the stored Gemini API key
 */
export async function removeGeminiApiKey(): Promise<void> {
    try {
        await chrome.storage.local.remove(STORAGE_KEY);
    } catch (error) {
        console.error('Failed to remove Gemini API key', error);
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
