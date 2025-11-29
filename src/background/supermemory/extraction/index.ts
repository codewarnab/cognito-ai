/**
 * Auto-Memory Extraction Module
 * Exports all extraction-related functionality.
 */

// Types
export type {
  ExtractedFact,
  ExtractionRequest,
  ExtractionResult,
  QueuedExtraction,
  ThreadExtractionMeta,
} from './types';

// Extraction service
export { extractFactsFromMessages, memoryExtractionService } from './extractionService';

// Add service
export { addFactsBatch, addFactToSupermemory, canAddToSupermemory } from './addService';

// Queue management
export {
  queueThreadForExtraction,
  getNextPendingExtraction,
  updateQueueItemStatus,
  cleanupCompletedItems,
  hasQueuedItems,
  resetFailedItems,
  getThreadExtractionMeta,
  saveThreadExtractionMeta,
  clearThreadExtractionMeta,
  clearAlarmIfEmpty,
} from './queue';

// Processor
export { processExtractionQueue, triggerImmediateExtraction } from './processor';

// Startup recovery
export { recoverExtractionQueue } from './startup';