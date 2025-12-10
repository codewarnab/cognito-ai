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

export interface ReportSection {
    id: string;              // Unique ID: 'section_1', 'section_2', etc.
    sessionId: string;       // Research session identifier
    sectionName: string;     // e.g., "Overview", "Key Features", "Pricing"
    content: string;         // Section content (markdown)
    order: number;           // Section order for final compilation
    createdAt: number;       // Timestamp
}

export interface ResearchSource {
    sourceId: string;
    sessionId: string;
    url: string;
    title: string;
    content: string;         // Full content (stored in DB, not context)
    contentLength: number;
    futureUseGuideline?: string;
    savedAt: number;
    expiresAt?: number;      // Optional TTL
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
