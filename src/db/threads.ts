/**
 * Chat Threads API
 */

import { db } from './database';
import type { ChatThread } from '~/types/database';

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
