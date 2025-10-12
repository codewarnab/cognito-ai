/**
 * Settings management for background service worker
 */

import { openDb, SETTINGS_STORE } from './database';
import type { Settings } from './types';

/**
 * Get a setting value
 */
export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K] | undefined> {
    const database = await openDb();

    return new Promise((resolve, reject) => {
        const tx = database.transaction([SETTINGS_STORE], 'readonly');
        const store = tx.objectStore(SETTINGS_STORE);
        const request = store.get(key);

        request.onsuccess = () => {
            const result = request.result as { key: string; value: Settings[K] } | undefined;
            resolve(result?.value);
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Set a setting value
 */
export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    const database = await openDb();

    return new Promise((resolve, reject) => {
        const tx = database.transaction([SETTINGS_STORE], 'readwrite');
        const store = tx.objectStore(SETTINGS_STORE);
        const request = store.put({ key, value });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Check if processing is paused
 */
export async function isPaused(): Promise<boolean> {
    const paused = await getSetting('paused');
    return paused ?? false;
}

/**
 * Set pause state
 */
export async function setPaused(paused: boolean): Promise<void> {
    await setSetting('paused', paused);
    console.log('[Settings] Pause state:', paused);
}

/**
 * Update queue statistics
 */
export async function updateQueueStats(field: 'successes' | 'failures', increment: number): Promise<void> {
    const database = await openDb();

    return new Promise((resolve, reject) => {
        const tx = database.transaction([SETTINGS_STORE], 'readwrite');
        const store = tx.objectStore(SETTINGS_STORE);

        const getRequest = store.get('queueStats');

        getRequest.onsuccess = () => {
            const existing = getRequest.result as { key: string; value: Settings['queueStats'] } | undefined;
            const stats = existing?.value ?? { total: 0, successes: 0, failures: 0 };

            stats[field] = (stats[field] ?? 0) + increment;
            stats.total = stats.successes + stats.failures;

            const putRequest = store.put({ key: 'queueStats', value: stats });
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
        };

        getRequest.onerror = () => reject(getRequest.error);
    });
}
