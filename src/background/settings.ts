/**
 * Settings management for background service worker
 */

import type { Settings } from './types';

/**
 * Get a setting value
 */
export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K] | undefined> {
    const result = await chrome.storage.local.get(key as string);
    return result[key as string];
}

/**
 * Set a setting value
 */
export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
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
