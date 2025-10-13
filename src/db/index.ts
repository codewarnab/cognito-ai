/**
 * Dexie IndexedDB Layer for Extension
 * 
 * Provides typed database interface with:
 * - Settings management
 * - Chat messages storage
 */

import Dexie, { type Table } from 'dexie';

// ============================================================================
// Type Definitions
// ============================================================================

export interface SettingRecord {
    key: string;
    value: any;
}

/**
 * Application settings
 */
export interface Settings {
    paused?: boolean;
}

/**
 * Chat message record for side panel chat UI
 */
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    metadata?: {
        streaming?: boolean;
        error?: boolean;
        regenerated?: boolean;
    };
}

// ============================================================================
// Dexie Database Class
// ============================================================================

export class AppDB extends Dexie {
    settings!: Table<SettingRecord, string>;
    chatMessages!: Table<ChatMessage, string>;

    constructor() {
        super('ChatDB');

        // Version 1: Initial schema with settings and chat messages
        this.version(1).stores({
            settings: 'key',
            chatMessages: 'id, timestamp'
        });
    }
}

// ============================================================================
// Database Instance
// ============================================================================

export const db = new AppDB();

// ============================================================================
// Settings API
// ============================================================================

/**
 * Get a setting value by key
 */
export async function getSetting<T = any>(key: string): Promise<T | undefined> {
    const record = await db.settings.get(key);
    return record?.value as T | undefined;
}

/**
 * Set a setting value
 */
export async function setSetting(key: string, value: any): Promise<void> {
    await db.settings.put({ key, value });
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

// ============================================================================
// Chat Messages API
// ============================================================================

/**
 * Save a chat message
 */
export async function saveChatMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    const fullMessage: ChatMessage = {
        ...message,
        id: crypto.randomUUID(),
        timestamp: Date.now()
    };
    await db.chatMessages.add(fullMessage);
    return fullMessage;
}

/**
 * Load chat history (all messages ordered by timestamp)
 */
export async function loadChatHistory(): Promise<ChatMessage[]> {
    return await db.chatMessages.orderBy('timestamp').toArray();
}

/**
 * Clear all chat messages
 */
export async function clearChatHistory(): Promise<void> {
    await db.chatMessages.clear();
}

/**
 * Delete a specific chat message
 */
export async function deleteChatMessage(id: string): Promise<void> {
    await db.chatMessages.delete(id);
}

// ============================================================================
// Database Management
// ============================================================================

/**
 * Clear all data from the database
 */
export async function wipeAllData(): Promise<void> {
    await db.transaction('rw', [db.settings, db.chatMessages], async () => {
        await db.settings.clear();
        await db.chatMessages.clear();
    });
}

/**
 * Get database statistics
 */
export async function getDBStats(): Promise<{
    chatMessageCount: number;
    settingsCount: number;
}> {
    const [chatMessageCount, settingsCount] = await Promise.all([
        db.chatMessages.count(),
        db.settings.count()
    ]);

    return {
        chatMessageCount,
        settingsCount
    };
}

// ============================================================================
// Exports
// ============================================================================

export default db;
