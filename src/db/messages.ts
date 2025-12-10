/**
 * Chat Messages API
 */

import { db } from './database';
import { updateThreadTimestamp } from './threads';
import type { ChatMessage } from '~/types/database';

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
