/**
 * Supermemory Utilities
 * Exports all Supermemory-related utility functions.
 */

// User ID management
export {
    getSupermemoryUserId,
    hasSupermemoryUserId,
    resetSupermemoryUserId
} from './userId';

// Credentials and configuration management
export {
    getSupermemoryApiKey,
    setSupermemoryApiKey,
    clearSupermemoryApiKey,
    hasSupermemoryApiKey,
    isSupermemoryEnabled,
    setSupermemoryEnabled,
    isSupermemoryReady,
    validateSupermemoryApiKeyFormat
} from './credentials';

// Auto-extraction settings
export {
    isAutoExtractionEnabled,
    setAutoExtractionEnabled,
    getAutoExtractionMinMessages,
    setAutoExtractionMinMessages,
} from './autoExtraction';

// Content memory settings (for Summarizer, Writer, Rewriter)
export {
    isContentMemoryEnabled,
    setContentMemoryEnabled,
    getEnabledContentMemorySources,
    setEnabledContentMemorySources,
} from './autoExtraction';

// Extraction trigger
export { maybeQueueForExtraction } from './extractionTrigger';
