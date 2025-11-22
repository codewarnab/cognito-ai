/**
 * Dexie IndexedDB Layer for Extension
 * 
 * Provides typed database interface with:
 * - Settings management
 * - Chat messages storage
 */

import Dexie, { type Table } from 'dexie';
import type {
    ChatThread,
    ChatMessage,
    SettingRecord,
    SettingsTypeMap,
    SettingKey,
    DBStats
} from '~/types/database';
import type { AppUsage } from '~/types/ai/usage';

// ============================================================================
// Type Definitions (Re-exported from ~/types/database)
// ============================================================================

// Re-export types for backward compatibility
export type {
    ChatThread,
    ChatMessage,
    SettingRecord,
    SettingsTypeMap,
    SettingKey,
    DBStats
};

/**
 * Application settings (derived from SettingsTypeMap)
 */
export type Settings = Partial<SettingsTypeMap>;

// ============================================================================
// Dexie Database Class
// ============================================================================

/**
 * Main database class extending Dexie
 * 
 * @remarks
 * This database uses IndexedDB to store:
 * - User settings (key-value pairs)
 * - Chat messages (complete UIMessage structures)
 * - Chat threads (conversation containers)
 * 
 * The schema has evolved through 5 versions:
 * - v1: Initial settings and messages
 * - v2: Added threads support
 * - v3: Added sequenceNumber for message ordering
 * - v4: Store complete UIMessage structure for tool calls
 * - v5: Added usage tracking fields
 */
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

// ============================================================================
// Chat Threads API
// ============================================================================

/**
 * Create a new chat thread
 * 
 * @param firstMessage - Optional first message to use as thread title
 * @param initialPageContext - Optional page context snapshot at thread creation
 * @returns The created thread with generated ID and timestamps
 * 
 * @example
 * ```typescript
 * const thread = await createThread("Hello!", "Page: example.com");
 * console.log(thread.id); // UUID
 * ```
 */
export async function createThread(
    firstMessage?: string,
    initialPageContext?: string
): Promise<ChatThread> {
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
 * 
 * @param threadId - The thread ID to update
 * @param title - New title for the thread
 */
export async function updateThreadTitle(threadId: string, title: string): Promise<void> {
    await db.chatThreads.update(threadId, {
        title,
        updatedAt: Date.now()
    });
}

/**
 * Get all threads ordered by most recent
 * 
 * @returns Array of threads sorted by updatedAt (newest first)
 */
export async function getAllThreads(): Promise<ChatThread[]> {
    return await db.chatThreads.orderBy('updatedAt').reverse().toArray();
}

/**
 * Get a specific thread by ID
 * 
 * @param threadId - The thread ID to retrieve
 * @returns The thread or undefined if not found
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
 * 
 * @param threadId - The thread ID to delete
 * @remarks Uses a transaction to ensure atomic deletion of thread and messages
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
 * 
 * @param message - Message data without id and timestamp (will be auto-generated)
 * @returns The complete saved message with id and timestamp
 * 
 * @remarks
 * - Automatically generates UUID for message ID if not present in message.message.id
 * - Sets timestamp to current time
 * - Updates parent thread's updatedAt timestamp
 * 
 * @example
 * ```typescript
 * const msg = await saveChatMessage({
 *   threadId: 'thread-123',
 *   message: {
 *     role: 'user',
 *     parts: [{ type: 'text', text: 'Hello!' }]
 *   }
 * });
 * ```
 */
export async function saveChatMessage(
    message: Omit<ChatMessage, 'id' | 'timestamp'>
): Promise<ChatMessage> {
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
 * 
 * @param threadId - The thread ID to load messages for
 * @returns Array of messages sorted by sequence number or timestamp
 * 
 * @remarks
 * Returns messages with complete UIMessage structure including tool calls.
 * Messages are sorted by sequenceNumber if available, otherwise by timestamp.
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
 * Clear all chat messages and threads
 */
export async function clearChatHistory(): Promise<void> {
    await db.transaction('rw', [db.chatMessages, db.chatThreads], async () => {
        await db.chatMessages.clear();
        await db.chatThreads.clear();
    });
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
 * 
 * @remarks
 * ⚠️ WARNING: This action is irreversible!
 * Removes all settings, messages, and threads from the database.
 * Uses a transaction to ensure atomic deletion.
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
 * 
 * @returns Object containing counts of messages, settings, and threads
 * 
 * @example
 * ```typescript
 * const stats = await getDBStats();
 * console.log(`Total messages: ${stats.chatMessageCount}`);
 * ```
 */
export async function getDBStats(): Promise<DBStats> {
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
 * 
 * @param threadId - The thread ID to calculate usage for
 * @returns Cumulative AppUsage summing all messages, or null if no messages
 * 
 * @remarks
 * Sums up all usage metrics from all messages in the thread:
 * - inputTokens
 * - outputTokens
 * - totalTokens
 * - cachedInputTokens
 * - reasoningTokens
 * 
 * Context limits and modelId are copied from the last message with usage.
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
 * Update thread's last usage statistics
 * 
 * @param threadId - The thread ID to update
 * @param usage - Usage statistics to store
 * 
 * @remarks
 * Also updates the thread's updatedAt timestamp
 */
export async function updateThreadUsage(threadId: string, usage: AppUsage): Promise<void> {
    await db.chatThreads.update(threadId, {
        lastUsage: usage,
        updatedAt: Date.now()
    });
}

/**
 * Save chat message with usage information
 * 
 * @param message - Message data without id and timestamp
 * @param usage - Optional token usage statistics for this message
 * @returns The complete saved message with id and timestamp
 * 
 * @remarks
 * - Automatically generates UUID and timestamp
 * - Updates thread timestamp
 * - If usage is provided, also updates thread's lastUsage
 * - Uses transaction to ensure atomic updates
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
