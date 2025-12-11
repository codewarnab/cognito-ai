/**
 * Dexie Database Class and Instance
 */

import Dexie, { type Table } from 'dexie';
import type {
    ChatThread,
    ChatMessage,
    SettingRecord
} from '~/types/database';
import type { ReportSection, ResearchSource } from './types';

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
 * The schema has evolved through 7 versions:
 * - v1: Initial settings and messages
 * - v2: Added threads support
 * - v3: Added sequenceNumber for message ordering
 * - v4: Store complete UIMessage structure for tool calls
 * - v5: Added usage tracking fields
 * - v6: Added report sections for incremental building
 * - v7: Added research sources for context offloading
 */
export class AppDB extends Dexie {
    settings!: Table<SettingRecord, string>;
    chatMessages!: Table<ChatMessage, string>;
    chatThreads!: Table<ChatThread, string>;
    reportSections!: Table<ReportSection, string>;
    researchSources!: Table<ResearchSource, string>;

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

        // Version 6: Add report sections for incremental building
        this.version(6).stores({
            settings: 'key',
            chatMessages: 'id, threadId, timestamp, sequenceNumber',
            chatThreads: 'id, createdAt, updatedAt',
            reportSections: 'id, sessionId, order'
        });

        // Version 7: Add research sources for context offloading
        this.version(7).stores({
            settings: 'key',
            chatMessages: 'id, threadId, timestamp, sequenceNumber',
            chatThreads: 'id, createdAt, updatedAt',
            reportSections: 'id, sessionId, order',
            researchSources: 'sourceId, sessionId, expiresAt'
        });
    }
}

// ============================================================================
// Database Instance
// ============================================================================

export const db = new AppDB();

export default db;
