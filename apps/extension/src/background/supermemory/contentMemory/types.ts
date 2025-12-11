/**
 * Content Memory Types
 * Types for memory building from content script interactions
 */

/**
 * Source type for content memory
 */
export type ContentMemorySource = 'summarizer' | 'writer' | 'rewriter';

/**
 * Base interface for content memory items
 */
interface BaseContentMemoryItem {
  id: string;
  source: ContentMemorySource;
  queuedAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  lastError?: string;
}

/**
 * Summarizer memory item
 * Captures what the user is reading/researching
 */
export interface SummarizerMemoryItem extends BaseContentMemoryItem {
  source: 'summarizer';
  data: {
    originalText: string;
    summary: string;
    summaryType: string;
    pageContext: {
      title: string;
      url: string;
      domain: string;
    };
  };
}

/**
 * Writer memory item
 * Captures what topics/contexts the user writes about
 */
export interface WriterMemoryItem extends BaseContentMemoryItem {
  source: 'writer';
  data: {
    prompt: string;
    generatedText: string;
    tone?: string;
    pageContext?: {
      title: string;
      url: string;
      domain: string;
      platform?: string;
      fieldType?: string;
    };
    hasAttachment: boolean;
  };
}

/**
 * Rewriter memory item
 * Captures user's writing style preferences
 */
export interface RewriterMemoryItem extends BaseContentMemoryItem {
  source: 'rewriter';
  data: {
    originalText: string;
    rewrittenText: string;
    preset?: string;
    customInstruction?: string;
    pageContext?: {
      title: string;
      url: string;
      domain: string;
    };
  };
}

/**
 * Union type for all content memory items
 */
export type ContentMemoryItem =
  | SummarizerMemoryItem
  | WriterMemoryItem
  | RewriterMemoryItem;

/**
 * Extracted insight from content interaction
 */
export interface ContentInsight {
  content: string;
  confidence: 'high' | 'medium';
  category: 'interest' | 'writing_style' | 'topic' | 'preference' | 'context';
  source: ContentMemorySource;
}

/**
 * Result of content memory processing
 */
export interface ContentMemoryResult {
  itemId: string;
  source: ContentMemorySource;
  insights: ContentInsight[];
  processedAt: number;
}
