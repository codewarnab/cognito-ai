/**
 * Dexie IndexedDB Layer for Extension
 * 
 * Provides typed database interface with:
 * - Settings management
 * - Chat messages storage
 */

import Dexie, { type Table } from 'dexie';
import type { AppUsage } from '../ai/types/usage';

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
    lastUsage?: AppUsage; // Track latest usage for thread
}

/**
 * Chat message record for side panel chat UI
 * Stores the complete UIMessage structure from AI SDK to preserve:
 * - Tool call parts (tool-call, tool-result)
 * - Text parts
 * - Custom data parts
 * - All metadata and timestamps
 */
export interface ChatMessage {
    id: string;
    threadId: string;
    message: any; // Store complete UIMessage as JSON (typed as 'any' to avoid circular deps)
    timestamp: number;
    sequenceNumber?: number; // Added to preserve message order
    usage?: AppUsage; // Store usage per message
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

        // Version 3: Add sequenceNumber for proper message ordering
        this.version(3).stores({
            settings: 'key',
            chatMessages: 'id, threadId, timestamp, sequenceNumber',
            chatThreads: 'id, createdAt, updatedAt'
        });

        // Version 4: Store complete UIMessage structure for tool call persistence
        this.version(4).stores({
            settings: 'key',
            chatMessages: 'id, threadId, timestamp, sequenceNumber',
            chatThreads: 'id, createdAt, updatedAt'
        }).upgrade(tx => {
            // Migration: Convert old format (role + content) to new format (message object)
            return tx.table('chatMessages').toCollection().modify((msg: any) => {
                // Check if this is old format (has 'role' and 'content' fields)
                if (msg.role && msg.content && !msg.message) {
                    // Convert to new format with complete UIMessage structure
                    msg.message = {
                        id: msg.id,
                        role: msg.role,
                        parts: [{ type: 'text', text: msg.content }],
                        createdAt: new Date(msg.timestamp)
                    };
                    // Remove old fields
                    delete msg.role;
                    delete msg.content;
                    delete msg.metadata;
                }
            });
        });

        // Version 5: Add usage tracking fields
        this.version(5).stores({
            settings: 'key',
            chatMessages: 'id, threadId, timestamp, sequenceNumber',
            chatThreads: 'id, createdAt, updatedAt'
        });
        // No data migration needed - new fields are optional
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
 * Save a chat message with complete UIMessage structure
 */
export async function saveChatMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    const fullMessage: ChatMessage = {
        ...message,
        id: message.message.id || crypto.randomUUID(),
        timestamp: Date.now()
    };
    await db.chatMessages.add(fullMessage);

    // Update thread timestamp
    await updateThreadTimestamp(message.threadId);

    return fullMessage;
}

/**
 * Load chat history for a specific thread
 * Returns messages with complete UIMessage structure including tool calls
 */
export async function loadThreadMessages(threadId: string): Promise<ChatMessage[]> {
    const messages = await db.chatMessages
        .where('threadId')
        .equals(threadId)
        .toArray();

    // Sort by sequenceNumber first (if available), then by timestamp as fallback
    return messages.sort((a, b) => {
        if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) {
            return a.sequenceNumber - b.sequenceNumber;
        }
        return a.timestamp - b.timestamp;
    });
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

/**
 * Validate that a message has the expected structure
 * Useful for debugging and ensuring data integrity
 */
export function isValidUIMessage(msg: any): boolean {
    return (
        msg &&
        typeof msg === 'object' &&
        'id' in msg &&
        'role' in msg &&
        'parts' in msg &&
        Array.isArray(msg.parts)
    );
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
// Token Usage Tracking API
// ============================================================================

/**
 * Calculate cumulative usage for a thread
 * Sums up all usage from all messages in the thread
 */
export async function getThreadUsage(threadId: string): Promise<AppUsage | null> {
    const messages = await db.chatMessages
        .where('threadId')
        .equals(threadId)
        .toArray();

    if (messages.length === 0) return null;

    // Sum up all usage
    const cumulative: AppUsage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cachedInputTokens: 0,
        reasoningTokens: 0
    };

    for (const msg of messages) {
        if (msg.usage) {
            cumulative.inputTokens = (cumulative.inputTokens || 0) + (msg.usage.inputTokens || 0);
            cumulative.outputTokens = (cumulative.outputTokens || 0) + (msg.usage.outputTokens || 0);
            cumulative.totalTokens = (cumulative.totalTokens || 0) + (msg.usage.totalTokens || 0);
            cumulative.cachedInputTokens = (cumulative.cachedInputTokens || 0) + (msg.usage.cachedInputTokens || 0);
            cumulative.reasoningTokens = (cumulative.reasoningTokens || 0) + (msg.usage.reasoningTokens || 0);

            // Copy context limits from last message with usage
            if (msg.usage.context) {
                cumulative.context = msg.usage.context;
            }

            // Copy model ID from last message with usage
            if (msg.usage.modelId) {
                cumulative.modelId = msg.usage.modelId;
            }
        }
    }

    return cumulative;
}

/**
 * Update thread's last usage
 */
export async function updateThreadUsage(threadId: string, usage: AppUsage): Promise<void> {
    await db.chatThreads.update(threadId, {
        lastUsage: usage,
        updatedAt: Date.now()
    });
}

/**
 * Save chat message with usage information
 */
export async function saveChatMessageWithUsage(
    message: Omit<ChatMessage, 'id' | 'timestamp'>,
    usage?: AppUsage
): Promise<ChatMessage> {
    const fullMessage: ChatMessage = {
        ...message,
        id: message.message.id || crypto.randomUUID(),
        timestamp: Date.now(),
        usage
    };
    await db.chatMessages.add(fullMessage);

    // Update thread timestamp and usage
    await db.transaction('rw', [db.chatThreads], async () => {
        await updateThreadTimestamp(message.threadId);
        if (usage) {
            await updateThreadUsage(message.threadId, usage);
        }
    });

    return fullMessage;
}

// ============================================================================
// Exports
// ============================================================================

export default db;
