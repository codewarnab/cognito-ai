/**
 * Research Sources API (Context Offloading) + Session Management
 */

import { db } from './database';
import { resetReportSectionCounter } from './reportSections';
import type { ResearchSource } from './types';

// ============================================================================
// Research Sources API
// ============================================================================

/**
 * Save a research source to IndexedDB
 */
export async function saveResearchSource(source: ResearchSource): Promise<void> {
    await db.researchSources.put(source);
}

/**
 * Get a specific research source by ID
 */
export async function getResearchSource(sourceId: string): Promise<ResearchSource | undefined> {
    return await db.researchSources.get(sourceId);
}

/**
 * List all research sources for a session (metadata only)
 * Note: Dexie doesn't natively support partial select, so we fetch all and map
 * But keeping the interface clean for potential future optimization
 */
export async function listResearchSources(sessionId: string): Promise<ResearchSource[]> {
    return await db.researchSources
        .where('sessionId')
        .equals(sessionId)
        .toArray();
}

/**
 * Update metadata for a research source
 */
export async function updateResearchSourceMetadata(
    sourceId: string,
    metadata: { futureUseGuideline?: string }
): Promise<void> {
    await db.researchSources.update(sourceId, metadata);
}

/**
 * Read full content of a research source (alias for getResearchSource)
 * Used by readResearchMemory tool
 */
export async function readResearchMemory(sourceId: string): Promise<ResearchSource | undefined> {
    return await getResearchSource(sourceId);
}

/**
 * Add metadata to a research source (alias for updateResearchSourceMetadata)
 * Used by addMemoryMetadata tool
 */
export async function addResearchMetadata(params: {
    sourceId: string;
    futureUseGuideline: string;
}): Promise<void> {
    await updateResearchSourceMetadata(params.sourceId, {
        futureUseGuideline: params.futureUseGuideline
    });
}

// ============================================================================
// Research Session Management
// ============================================================================

let currentResearchSessionId: string | null = null;

/**
 * Initialize a new research session with a unique ID.
 * 
 * @returns The newly generated session ID (UUID v4)
 * 
 * @remarks
 * This function performs two actions:
 * 1. Generates a new UUID for the research session
 * 2. Resets the report section counter to 0
 * 
 * Call this at the start of each new research workflow to ensure
 * proper isolation of sources and report sections.
 * 
 * @example
 * ```typescript
 * const sessionId = initResearchSession();
 * // sessionId: "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export function initResearchSession(): string {
    currentResearchSessionId = crypto.randomUUID();
    resetReportSectionCounter();
    return currentResearchSessionId;
}

/**
 * Get the current research session ID.
 * 
 * @returns The current session ID, or null if no session is active
 * 
 * @remarks
 * Returns null if initResearchSession() has not been called yet.
 * Use this to check if a research session is in progress before
 * performing session-dependent operations.
 * 
 * @example
 * ```typescript
 * const sessionId = getCurrentResearchSessionId();
 * if (sessionId) {
 *   await saveResearchSource({ sessionId, ... });
 * }
 * ```
 */
export function getCurrentResearchSessionId(): string | null {
    return currentResearchSessionId;
}
