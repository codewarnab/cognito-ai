/**
 * Database Management API
 */

import { db } from './database';
import type { DBStats } from '~/types/database';

/**
 * Clear all data from the database
 * 
 * @remarks
 * ⚠️ WARNING: This action is irreversible!
 * Removes all settings, messages, and threads from the database.
 * Uses a transaction to ensure atomic deletion.
 * 
 * @example
 * ```typescript
 * // Always confirm with user before wiping
 * if (confirm('Are you sure you want to delete all data?')) {
 *   await wipeAllData();
 *   console.log('All data has been cleared');
 * }
 * ```
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
