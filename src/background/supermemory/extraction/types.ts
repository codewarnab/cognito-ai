/**
 * Type definitions for auto-memory extraction feature
 * Phase 2 of the auto-memory-extraction implementation
 */

import type { ChatMessage } from '~/types/database/schema';

/**
 * A fact extracted from a conversation
 */
export interface ExtractedFact {
  /** The fact content to be saved to memory */
  content: string;

  /** Confidence level of the extraction */
  confidence: 'high' | 'medium';

  /** Category for organization */
  category: 'preference' | 'fact' | 'interest' | 'instruction' | 'context';
}

/**
 * Request to extract facts from a thread
 */
export interface ExtractionRequest {
  threadId: string;
  messages: ChatMessage[];
}

/**
 * Result of extraction processing
 */
export interface ExtractionResult {
  threadId: string;
  facts: ExtractedFact[];
  processedAt: number;
  messageCount: number;
  contentHash: string;
}

/**
 * Item in the extraction queue
 */
export interface QueuedExtraction {
  threadId: string;
  queuedAt: number;
  messageCount: number;
  retryCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  lastError?: string;
}

/**
 * Stored extraction metadata for a thread
 */
export interface ThreadExtractionMeta {
  lastExtractionAt: number;
  lastContentHash: string;
  messageCountAtExtraction: number;
  extractedFactsCount: number;
}
