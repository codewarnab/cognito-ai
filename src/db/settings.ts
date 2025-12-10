/**
 * Settings API
 */

import { db } from './database';
import type { SettingsTypeMap, SettingKey } from '~/types/database';
import type { Settings } from './types';

/**
 * Get a setting value by key (type-safe)
 * @template K - The setting key from SettingsTypeMap
 * @param key - The setting key
 * @returns The typed setting value or undefined if not found
 */
export async function getSetting<K extends SettingKey>(
    key: K
): Promise<SettingsTypeMap[K] | undefined> {
    const record = await db.settings.get(key);
    return record?.value as SettingsTypeMap[K] | undefined;
}

/**
 * Set a setting value (type-safe)
 * @template K - The setting key from SettingsTypeMap
 * @param key - The setting key
 * @param value - The typed value for this setting
 */
export async function setSetting<K extends SettingKey>(
    key: K,
    value: SettingsTypeMap[K]
): Promise<void> {
    await db.settings.put({ key, value });
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
 */
export async function getAllSettings(): Promise<Settings> {
    const records = await db.settings.toArray();
    const settings: any = {};
    for (const record of records) {
        settings[record.key] = record.value;
    }
    return settings;
}

/**
 * Update multiple settings at once
 */
export async function updateSettings(updates: Partial<Settings>): Promise<void> {
    const entries = Object.entries(updates);
    await db.settings.bulkPut(
        entries.map(([key, value]) => ({ key, value }))
    );
}
