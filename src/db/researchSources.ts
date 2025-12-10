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

export function initResearchSession(): string {
    currentResearchSessionId = crypto.randomUUID();
    resetReportSectionCounter();
    return currentResearchSessionId;
}

export function getCurrentResearchSessionId(): string | null {
    return currentResearchSessionId;
}
