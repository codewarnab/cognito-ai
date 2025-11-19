/**
 * Chrome Summarizer API Utility
 * 
 * Provides functions to generate summaries using Chrome's built-in Summarizer API.
 * Falls back gracefully when the API is not available.
 */

import { createLogger } from '@logger';

const log = createLogger('Summarizer');

/**
 * Availability status for the Summarizer API
 */
export type SummarizerAvailability = 'readily' | 'after-download' | 'no';

/**
 * Download progress event
 */
export interface DownloadProgressEvent {
    loaded: number;
    total: number;
}

/**
 * Summarizer options
 */
export interface SummarizerOptions {
    type?: 'key-points' | 'tl;dr' | 'teaser' | 'headline';
    format?: 'markdown' | 'plain-text';
    length?: 'short' | 'medium' | 'long';
    sharedContext?: string;
    onDownloadProgress?: (progress: number) => void;
}

/**
 * Chrome Summarizer API types
 */
declare global {
    interface Window {
        ai?: {
            summarizer?: {
                capabilities(): Promise<{ available: 'readily' | 'after-download' | 'no' }>;
                create(options?: {
                    type?: string;
                    format?: string;
                    length?: string;
                    sharedContext?: string;
                    monitor?: (monitor: any) => void;
                }): Promise<{
                    summarize(text: string, options?: { context?: string }): Promise<string>;
                    summarizeStreaming(text: string, options?: { context?: string }): AsyncIterable<string>;
                    destroy(): void;
                }>;
            };
        };
    }
}



/**
 * Create a summarizer instance
 */
export async function createSummarizer(_options: SummarizerOptions = {}) {
    // This function is no longer used directly; summarization now runs in offscreen.
    throw new Error('createSummarizer is not available in UI context. Use generateThreadTitle which proxies to offscreen.');
}


/**
 * Generate a headline/title from text using the Summarizer API
 * 
 * @param text - The text to summarize
 * @param options - Optional configuration
 * @returns A promise that resolves to the headline, or null if API unavailable
 */
export async function generateHeadline(
    text: string,
    options: {
        maxLength?: number;
        context?: string;
        onDownloadProgress?: (progress: number) => void;
    } = {}
): Promise<string | null> {
    const {
        maxLength = 40,
        context,
        onDownloadProgress
    } = options;

    // Clean the text - remove HTML and extra whitespace
    const cleanText = text
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/\s+/g, ' ')     // Normalize whitespace
        .trim();

    if (!cleanText || cleanText.length < 10) {
        log.warn('Text too short to summarize');
        return null;
    }

    log.info('Requesting offscreen summarize for headline generation');

    // Subscribe to progress events for this requestId
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let lastProgressReported = -1;

    const progressListener = (msg: any) => {
        if (msg?.type === 'summarize:progress' && msg?.payload?.requestId === requestId) {
            const loaded = typeof msg.payload.loaded === 'number' ? msg.payload.loaded : 0;
            const progressPercent = Math.floor(loaded * 100);

            // Only report progress changes >= 10%
            if (progressPercent - lastProgressReported >= 10) {
                lastProgressReported = progressPercent;
                onDownloadProgress?.(loaded);
                log.info(`Model download progress: ${progressPercent}%`);
            }
        }
    };
    chrome.runtime.onMessage.addListener(progressListener);

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'summarize:request',
            payload: {
                requestId,
                text: cleanText,
                options: {
                    type: 'headline',
                    format: 'plain-text',
                    length: 'short',
                    sharedContext: context
                },
                context
            }
        });

        if (!response?.ok) {
            log.warn('Offscreen summarizer error', response);
            return null;
        }

        const headline = String(response.summary || '');
        log.info('Raw headline generated:', headline);

        // Truncate if needed
        const finalHeadline = headline.length > maxLength
            ? headline.slice(0, maxLength) + '...'
            : headline;

        log.info('Final headline:', finalHeadline);
        return finalHeadline;
    } catch (error) {
        log.error('Error generating headline via offscreen:', error);
        return null;
    } finally {
        chrome.runtime.onMessage.removeListener(progressListener);
    }
}

/**
 * Generate a streaming headline (for real-time updates)
 * 
 * @param text - The text to summarize
 * @param onChunk - Callback for each chunk of the summary
 * @param options - Optional configuration
 */
export async function generateHeadlineStreaming(
    text: string,
    onChunk: (chunk: string) => void,
    options: {
        context?: string;
        onDownloadProgress?: (progress: number) => void;
    } = {}
): Promise<void> {
    // Temporary non-streaming fallback using offscreen batch API
    const result = await generateHeadline(text, {
        context: options.context,
        onDownloadProgress: options.onDownloadProgress
    });
    if (result) {
        onChunk(result);
    }
}

/**
 * Generate a fallback title from text (used when Summarizer API is unavailable)
 * 
 * @param text - The text to create a title from
 * @param maxLength - Maximum length of the title
 * @returns A truncated version of the text
 */
export function generateFallbackTitle(text: string, maxLength: number = 40): string {
    const cleanText = text
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleanText) {
        return 'New Chat';
    }

    return cleanText.length > maxLength
        ? cleanText.slice(0, maxLength) + '...'
        : cleanText;
}

/**
 * Generate a thread title with automatic fallback
 * 
 * @param text - The first message text
 * @param options - Optional configuration
 * @returns A promise that resolves to the generated title
 */
export async function generateThreadTitle(
    text: string,
    options: {
        maxLength?: number;
        context?: string;
        onDownloadProgress?: (progress: number) => void;
    } = {}
): Promise<string> {
    const { maxLength = 40, context, onDownloadProgress } = options;

    log.info('generateThreadTitle called with text:', text.slice(0, 100));

    // Try to use Summarizer API
    const headline = await generateHeadline(text, {
        maxLength,
        context: context || 'This is the first message of a chat conversation',
        onDownloadProgress
    });

    // Fallback to simple truncation if API unavailable
    if (!headline) {
        log.info('Using fallback title generation');
        return generateFallbackTitle(text, maxLength);
    }

    log.info('Generated AI title:', headline);
    return headline;
}