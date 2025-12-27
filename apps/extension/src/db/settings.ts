/**
 * Settings API with In-Memory Caching
 * 
 * Uses a short-lived cache (5s TTL) to reduce IndexedDB queries for
 * frequently accessed settings while ensuring data freshness.
 */

import { db } from './database';
import type { SettingsTypeMap, SettingKey } from '~/types/database';
import type { Settings } from './types';

// ============================================================================
// Settings Cache - 5-second TTL for quick reads
// ============================================================================

interface CacheEntry<T> {
    value: T;
    timestamp: number;
}

const CACHE_TTL_MS = 5000; // 5 seconds
const settingsCache = new Map<string, CacheEntry<unknown>>();

/**
 * Check if a cache entry is still valid
 */
function isCacheValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
    return !!entry && Date.now() - entry.timestamp < CACHE_TTL_MS;
}

/**
 * Get a setting value by key (type-safe)
 * Uses cache for frequent reads
 * @template K - The setting key from SettingsTypeMap
 * @param key - The setting key
 * @returns The typed setting value or undefined if not found
 */
export async function getSetting<K extends SettingKey>(
    key: K
): Promise<SettingsTypeMap[K] | undefined> {
    // Check cache first
    const cached = settingsCache.get(key);
    if (isCacheValid(cached)) {
        return cached.value as SettingsTypeMap[K] | undefined;
    }

    // Fetch from IndexedDB
    const record = await db.settings.get(key);
    const value = record?.value as SettingsTypeMap[K] | undefined;

    // Cache the result
    settingsCache.set(key, { value, timestamp: Date.now() });

    return value;
}

/**
 * Set a setting value (type-safe)
 * Invalidates cache on write
 * @template K - The setting key from SettingsTypeMap
 * @param key - The setting key
 * @param value - The typed value for this setting
 */
export async function setSetting<K extends SettingKey>(
    key: K,
    value: SettingsTypeMap[K]
): Promise<void> {
    await db.settings.put({ key, value });
    // Update cache with new value
    settingsCache.set(key, { value, timestamp: Date.now() });
}

/**
 * Get the last active thread ID
 */
export async function getLastActiveThreadId(): Promise<string | null> {
    return await getSetting('lastActiveThreadId') || null;
}

/**
 * Set the last active thread ID
 */
export async function setLastActiveThreadId(threadId: string): Promise<void> {
    await setSetting('lastActiveThreadId', threadId);
}

/**
 * Get the browser session ID (changes on restart)
 */
export async function getBrowserSessionId(): Promise<string | null> {
    return await getSetting('browserSessionId') || null;
}

/**
 * Set the browser session ID
 */
export async function setBrowserSessionId(sessionId: string): Promise<void> {
    await setSetting('browserSessionId', sessionId);
}

/**
 * Get all settings as a single object
 * Note: This bypasses the per-key cache for bulk reads
 */
export async function getAllSettings(): Promise<Settings> {
    const records = await db.settings.toArray();
    const settings: any = {};
    for (const record of records) {
        settings[record.key] = record.value;
        // Populate cache with fetched values
        settingsCache.set(record.key, { value: record.value, timestamp: Date.now() });
    }
    return settings;
}

/**
 * Update multiple settings at once
 * Invalidates all cached settings
 */
export async function updateSettings(updates: Partial<Settings>): Promise<void> {
    const entries = Object.entries(updates);
    await db.settings.bulkPut(
        entries.map(([key, value]) => ({ key, value }))
    );
    // Update cache with new values
    for (const [key, value] of entries) {
        settingsCache.set(key, { value, timestamp: Date.now() });
    }
}

/**
 * Clear settings cache for specific keys
 * Used when other contexts (e.g., webapp) update storage and we need fresh data
 * @param keys Keys to clear from cache. If empty, clears all cache.
 */
export function clearSettingsCache(keys?: string[]): void {
    if (!keys || keys.length === 0) {
        settingsCache.clear();
    } else {
        for (const key of keys) {
            settingsCache.delete(key);
        }
    }
}
