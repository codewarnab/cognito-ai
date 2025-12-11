/**
 * Auto-Extraction Settings Management
 * Handles storage and retrieval of auto memory extraction settings.
 */

import { createLogger } from '~logger';
import type { ContentMemorySource } from '@/background/supermemory/contentMemory/types';

const log = createLogger('AutoExtractionSettings', 'UTILS');

const AUTO_EXTRACTION_ENABLED_KEY = 'supermemory:autoExtraction';
const AUTO_EXTRACTION_MIN_MESSAGES_KEY = 'supermemory:autoExtractionMinMessages';
const DEFAULT_MIN_MESSAGES = 4;

// Content Memory Settings Keys
const CONTENT_MEMORY_ENABLED_KEY = 'supermemory:contentMemoryEnabled';
const CONTENT_MEMORY_SOURCES_KEY = 'supermemory:contentMemorySources';
const DEFAULT_CONTENT_MEMORY_SOURCES: ContentMemorySource[] = ['summarizer', 'writer', 'rewriter'];

/**
 * Checks if auto-extraction is enabled.
 * 
 * @returns Promise<boolean> - True if auto-extraction is enabled
 */
export async function isAutoExtractionEnabled(): Promise<boolean> {
    try {
        const storage = await chrome.storage.local.get(AUTO_EXTRACTION_ENABLED_KEY);
        return storage[AUTO_EXTRACTION_ENABLED_KEY] === true;
    } catch (error) {
        log.error('Failed to check auto-extraction enabled state', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
    }
}

/**
 * Sets the auto-extraction enabled state.
 * 
 * @param enabled - Whether auto-extraction should be enabled
 * @returns Promise<void>
 */
export async function setAutoExtractionEnabled(enabled: boolean): Promise<void> {
    try {
        await chrome.storage.local.set({ [AUTO_EXTRACTION_ENABLED_KEY]: enabled });
        log.info('Auto-extraction enabled state updated', { enabled });
    } catch (error) {
        log.error('Failed to update auto-extraction enabled state', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

/**
 * Gets the minimum number of messages required for auto-extraction.
 * 
 * @returns Promise<number> - Minimum message count (default: 4)
 */
export async function getAutoExtractionMinMessages(): Promise<number> {
    try {
        const storage = await chrome.storage.local.get(AUTO_EXTRACTION_MIN_MESSAGES_KEY);
        const value = storage[AUTO_EXTRACTION_MIN_MESSAGES_KEY];
        return typeof value === 'number' && value >= 2 ? value : DEFAULT_MIN_MESSAGES;
    } catch (error) {
        log.error('Failed to get auto-extraction min messages', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return DEFAULT_MIN_MESSAGES;
    }
}

/**
 * Sets the minimum number of messages required for auto-extraction.
 * 
 * @param count - Minimum message count (must be >= 2)
 * @returns Promise<void>
 */
export async function setAutoExtractionMinMessages(count: number): Promise<void> {
    const validCount = Math.max(2, Math.floor(count));
    try {
        await chrome.storage.local.set({ [AUTO_EXTRACTION_MIN_MESSAGES_KEY]: validCount });
        log.info('Auto-extraction min messages updated', { count: validCount });
    } catch (error) {
        log.error('Failed to update auto-extraction min messages', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

// ============================================================================
// Content Memory Settings (for Summarizer, Writer, Rewriter)
// ============================================================================

/**
 * Checks if content memory building is enabled.
 * 
 * @returns Promise<boolean> - True if content memory is enabled
 */
export async function isContentMemoryEnabled(): Promise<boolean> {
    try {
        const storage = await chrome.storage.local.get(CONTENT_MEMORY_ENABLED_KEY);
        return storage[CONTENT_MEMORY_ENABLED_KEY] === true;
    } catch (error) {
        log.error('Failed to check content memory enabled state', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
    }
}

/**
 * Sets the content memory enabled state.
 * 
 * @param enabled - Whether content memory should be enabled
 * @returns Promise<void>
 */
export async function setContentMemoryEnabled(enabled: boolean): Promise<void> {
    try {
        await chrome.storage.local.set({ [CONTENT_MEMORY_ENABLED_KEY]: enabled });
        log.info('Content memory enabled state updated', { enabled });
    } catch (error) {
        log.error('Failed to update content memory enabled state', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

/**
 * Gets the enabled content memory sources.
 * 
 * @returns Promise<ContentMemorySource[]> - Array of enabled sources
 */
export async function getEnabledContentMemorySources(): Promise<ContentMemorySource[]> {
    try {
        const storage = await chrome.storage.local.get(CONTENT_MEMORY_SOURCES_KEY);
        const sources = storage[CONTENT_MEMORY_SOURCES_KEY];
        return Array.isArray(sources) ? sources : DEFAULT_CONTENT_MEMORY_SOURCES;
    } catch (error) {
        log.error('Failed to get enabled content memory sources', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return DEFAULT_CONTENT_MEMORY_SOURCES;
    }
}

/**
 * Sets the enabled content memory sources.
 * 
 * @param sources - Array of sources to enable
 * @returns Promise<void>
 */
export async function setEnabledContentMemorySources(sources: ContentMemorySource[]): Promise<void> {
    try {
        await chrome.storage.local.set({ [CONTENT_MEMORY_SOURCES_KEY]: sources });
        log.info('Content memory sources updated', { sources });
    } catch (error) {
        log.error('Failed to update content memory sources', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}
