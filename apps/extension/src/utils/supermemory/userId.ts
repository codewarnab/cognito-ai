/**
 * Supermemory User ID Management
 * Generates and persists a unique user ID for Supermemory integration.
 * Uses UUID v4 format generated via crypto.randomUUID().
 */

import { createLogger } from '~logger';

const log = createLogger('SupermemoryUserId', 'UTILS');

const STORAGE_KEY = 'supermemory:userId';

/**
 * Gets or generates a persistent user ID for Supermemory.
 * The ID is stored in chrome.storage.local and persists across sessions.
 * 
 * @returns Promise<string> - The user's unique Supermemory ID (UUID v4 format)
 */
export async function getSupermemoryUserId(): Promise<string> {
    try {
        const storage = await chrome.storage.local.get(STORAGE_KEY);

        if (storage[STORAGE_KEY]) {
            log.debug('Retrieved existing Supermemory user ID');
            return storage[STORAGE_KEY];
        }

        // Generate new UUID using native crypto API
        const newId = crypto.randomUUID();
        await chrome.storage.local.set({ [STORAGE_KEY]: newId });

        log.info('Generated new Supermemory user ID');
        return newId;
    } catch (error) {
        log.error('Failed to get/generate Supermemory user ID', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        // Generate a fallback ID that won't be persisted
        // This ensures the extension still works even if storage fails
        return crypto.randomUUID();
    }
}

/**
 * Checks if a Supermemory user ID already exists.
 * Useful for checking first-run state without generating a new ID.
 * 
 * @returns Promise<boolean> - True if user ID exists
 */
export async function hasSupermemoryUserId(): Promise<boolean> {
    try {
        const storage = await chrome.storage.local.get(STORAGE_KEY);
        return !!storage[STORAGE_KEY];
    } catch (error) {
        log.error('Failed to check Supermemory user ID existence', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return false;
    }
}

/**
 * Resets the Supermemory user ID.
 * This will cause a new ID to be generated on next getSupermemoryUserId() call.
 * Use with caution - this will effectively create a new user profile in Supermemory.
 * 
 * @returns Promise<void>
 */
export async function resetSupermemoryUserId(): Promise<void> {
    try {
        await chrome.storage.local.remove(STORAGE_KEY);
        log.info('Reset Supermemory user ID');
    } catch (error) {
        log.error('Failed to reset Supermemory user ID', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
}
