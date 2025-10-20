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
 * Chat thread record
 */
export interface ChatThread {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    initialPageContext?: string; // Page context snapshot at thread creation
}

/**
 * Chat message record for side panel chat UI
 */
export interface ChatMessage {
    id: string;
    threadId: string;
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
    chatThreads!: Table<ChatThread, string>;

    constructor() {
        super('ChatDB');

        // Version 1: Initial schema with settings and chat messages
        this.version(1).stores({
            settings: 'key',
            chatMessages: 'id, timestamp'
        });

        // Version 2: Add threads support
        this.version(2).stores({
            settings: 'key',
            chatMessages: 'id, threadId, timestamp',
            chatThreads: 'id, createdAt, updatedAt'
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
 * Get the last active thread ID
 */
export async function getLastActiveThreadId(): Promise<string | null> {
    return await getSetting<string>('lastActiveThreadId') || null;
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
    return await getSetting<string>('browserSessionId') || null;
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

// ============================================================================
// Chat Threads API
// ============================================================================

/**
 * Create a new chat thread
 */
export async function createThread(firstMessage?: string, initialPageContext?: string): Promise<ChatThread> {
    const thread: ChatThread = {
        id: crypto.randomUUID(),
        title: firstMessage
            ? (firstMessage.slice(0, 40) + (firstMessage.length > 40 ? '...' : ''))
            : 'New Chat',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        initialPageContext
    };
    await db.chatThreads.add(thread);
    return thread;
}

/**
 * Update thread title
 */
export async function updateThreadTitle(threadId: string, title: string): Promise<void> {
    await db.chatThreads.update(threadId, {
        title,
        updatedAt: Date.now()
    });
}

/**
 * Get all threads ordered by most recent
 */
export async function getAllThreads(): Promise<ChatThread[]> {
    return await db.chatThreads.orderBy('updatedAt').reverse().toArray();
}

/**
 * Get a specific thread
 */
export async function getThread(threadId: string): Promise<ChatThread | undefined> {
    return await db.chatThreads.get(threadId);
}

/**
 * Update thread's updatedAt timestamp
 */
export async function updateThreadTimestamp(threadId: string): Promise<void> {
    await db.chatThreads.update(threadId, { updatedAt: Date.now() });
}

/**
 * Delete a thread and all its messages
 */
export async function deleteThread(threadId: string): Promise<void> {
    await db.transaction('rw', [db.chatThreads, db.chatMessages], async () => {
        await db.chatThreads.delete(threadId);
        await db.chatMessages.where('threadId').equals(threadId).delete();
    });
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

    // Update thread timestamp
    await updateThreadTimestamp(message.threadId);

    return fullMessage;
}

/**
 * Load chat history for a specific thread
 */
export async function loadThreadMessages(threadId: string): Promise<ChatMessage[]> {
    return await db.chatMessages
        .where('threadId')
        .equals(threadId)
        .sortBy('timestamp');
}

/**
 * Clear all chat messages for a specific thread
 */
export async function clearThreadMessages(threadId: string): Promise<void> {
    await db.chatMessages.where('threadId').equals(threadId).delete();
}

/**
 * Clear all chat messages (legacy - clears all threads)
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
    await db.transaction('rw', [db.settings, db.chatMessages, db.chatThreads], async () => {
        await db.settings.clear();
        await db.chatMessages.clear();
        await db.chatThreads.clear();
    });
}

/**
 * Get database statistics
 */
export async function getDBStats(): Promise<{
    chatMessageCount: number;
    settingsCount: number;
    threadCount: number;
}> {
    const [chatMessageCount, settingsCount, threadCount] = await Promise.all([
        db.chatMessages.count(),
        db.settings.count(),
        db.chatThreads.count()
    ]);

    return {
        chatMessageCount,
        settingsCount,
        threadCount
    };
}

// ============================================================================
// Exports
// ============================================================================

export default db;
