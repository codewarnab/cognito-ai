/**
 * Database Types and Interfaces
 */

import type {
    ChatThread,
    ChatMessage,
    SettingRecord,
    SettingsTypeMap,
    SettingKey,
    DBStats
} from '~/types/database';

// ============================================================================
// Report Section Interface (For Incremental Report Building)
// ============================================================================

/**
 * Represents a section of a research report stored in IndexedDB.
 * Sections are accumulated during research and compiled into the final report.
 */
export interface ReportSection {
    /** Unique section identifier (e.g., 'section_1', 'section_2') */
    id: string;
    /** Research session identifier this section belongs to */
    sessionId: string;
    /** Human-readable section name (e.g., "Overview", "Key Features", "Pricing") */
    sectionName: string;
    /** Section content in markdown format */
    content: string;
    /** Numeric order for final report compilation (1-based) */
    order: number;
    /** Unix timestamp (ms) when section was created */
    createdAt: number;
}

/**
 * Represents a research source stored in IndexedDB for context offloading.
 * Full content is stored in DB to avoid bloating the AI context window.
 */
export interface ResearchSource {
    /** Unique source identifier */
    sourceId: string;
    /** Research session identifier this source belongs to */
    sessionId: string;
    /** Original URL of the source */
    url: string;
    /** Page title or document name */
    title: string;
    /** Full content stored in DB (not kept in context) */
    content: string;
    /** Character count of the content */
    contentLength: number;
    /** Optional guideline for future reference of this source */
    futureUseGuideline?: string;
    /** Unix timestamp (ms) when source was saved */
    savedAt: number;
    /** Optional Unix timestamp (ms) for auto-cleanup (TTL) */
    expiresAt?: number;
}

// ============================================================================
// Stored PDF Interface (For Persistent PDF Storage)
// ============================================================================

/**
 * PDF stored in IndexedDB for persistent access.
 * Fixes blob URL issue where PDFs can't be opened in new tabs.
 */
export interface StoredPDF {
    /** Unique identifier (UUID) */
    id: string;
    /** Original or generated filename for the PDF */
    filename: string;
    /** PDF binary data as a Blob */
    blob: Blob;
    /** File size in bytes */
    size: number;
    /** Unix timestamp (ms) when PDF was stored */
    createdAt: number;
    /** Unix timestamp (ms) for auto-cleanup (default: 24 hours after creation) */
    expiresAt: number;
}

// ============================================================================
// Type Re-exports (Backward compatibility)
// ============================================================================

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
