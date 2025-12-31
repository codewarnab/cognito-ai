/**
 * Supermemory User ID Management
 * Generates and persists a unique user ID for Supermemory integration.
 * Uses UUID v4 format generated via crypto.randomUUID().
 */

import { createLogger } from '~logger';

const log = createLogger('SupermemoryUserId', 'CREDENTIALS_STORAGE');

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

        // Try to generate a stable ID using device fingerprinting
        try {
            // Dynamically import to avoid issues in contexts where offscreen API isn't available
            // or if ensureOffscreenDocument has side effects
            const { ensureOffscreenDocument } = await import('@/offscreen/ensure');

            // Only attempt if we have the permission/ability (e.g. in background script)
            if (chrome.offscreen) {
                await ensureOffscreenDocument();

                const response = await chrome.runtime.sendMessage({
                    type: 'offscreen/fingerprint/request'
                }) as { ok: boolean, fingerprint?: string, error?: string };

                if (response?.ok && response?.fingerprint) {
                    const fp = response.fingerprint;
                    // Create UUID-like format from SHA-256 hash (take first 32 chars)
                    // Format: 8-4-4-4-12
                    const stableId = `${fp.substring(0, 8)}-${fp.substring(8, 12)}-${fp.substring(12, 16)}-${fp.substring(16, 20)}-${fp.substring(20, 32)}`;

                    await chrome.storage.local.set({ [STORAGE_KEY]: stableId });
                    log.info('Generated stable Supermemory user ID from fingerprint');
                    return stableId;
                }
            }
        } catch (fpError) {
            log.warn('Failed to generate stable fingerprint ID, falling back to random', fpError);
        }

        // Generate new UUID using native crypto API (Fallback)
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
