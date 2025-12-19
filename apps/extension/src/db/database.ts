/**
 * Dexie Database Class and Instance
 * 
 * DSA Optimization: Uses compound index [threadId+sequenceNumber] for
 * O(n) pre-sorted message retrieval instead of O(n log n) post-sort.
 */

import Dexie, { type Table } from 'dexie';
import type {
    ChatThread,
    ChatMessage,
    SettingRecord
} from '~/types/database';
import type { ReportSection, ResearchSource, StoredPDF } from './types';

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
 * - Report sections for incremental building
 * - Research sources for context offloading
 * - Stored PDFs for persistent PDF access
 * 
 * Uses compound index [threadId+sequenceNumber] for efficient sorted message retrieval.
 */
export class AppDB extends Dexie {
    settings!: Table<SettingRecord, string>;
    chatMessages!: Table<ChatMessage, string>;
    chatThreads!: Table<ChatThread, string>;
    reportSections!: Table<ReportSection, string>;
    researchSources!: Table<ResearchSource, string>;
    storedPDFs!: Table<StoredPDF, string>;

    constructor() {
        super('ChatDB');

        // Single version schema with compound index for message ordering
        // Using compound index [threadId+sequenceNumber] enables:
        // - O(1) lookup by threadId
        // - Pre-sorted retrieval by sequenceNumber (no post-sort needed)
        this.version(1).stores({
            settings: 'key',
            // Compound index [threadId+sequenceNumber] for sorted message queries
            chatMessages: 'id, threadId, timestamp, sequenceNumber, [threadId+sequenceNumber]',
            chatThreads: 'id, createdAt, updatedAt',
            reportSections: 'id, sessionId, order',
            researchSources: 'sourceId, sessionId, expiresAt',
            storedPDFs: '&id, filename, createdAt, expiresAt'
        });
    }
}

// ============================================================================
// Database Instance
// ============================================================================

export const db = new AppDB();

export default db;
