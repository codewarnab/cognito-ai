/**
 * Chrome Summarizer API Utility
 * 
 * Provides functions to generate summaries using Chrome's built-in Summarizer API.
 * Falls back gracefully when the API is not available.
 */

import { createLogger } from '../logger';

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
            Summarizer: {
                availability():  'unavailable' | 'downloadable' | 'downloading' | 'available';
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
        }
}



/**
 * Create a summarizer instance
 */
export async function createSummarizer(options: SummarizerOptions = {}) {
    const {
        type = 'headline',
        format = 'plain-text',
        length = 'short',
        sharedContext,
        onDownloadProgress
    } = options;

    try {
        if (!window.Summarizer) {
            throw new Error('Summarizer API not available');
        }
        
        // Check availability
        const availability = await window.Summarizer.availability();
        if (availability === 'unavailable') {
            throw new Error('Summarizer API is not available on this device');
        }

        const summarizerOptions: any = {
            type,
            format,
            length,
            sharedContext
        };

        // Add download monitor if callback provided
        if (onDownloadProgress && availability === 'downloadable') {
            summarizerOptions.monitor = (m: any) => {
                m.addEventListener('downloadprogress', (e: any) => {
                    const progress = e.loaded || 0;
                    onDownloadProgress(progress);
                    log.info(`Model download progress: ${(progress * 100).toFixed(1)}%`);
                });
            };
        }

        const summarizer = await window.Summarizer.create(summarizerOptions);
        log.info('Summarizer created successfully', { type, format, length });
        
        return summarizer;
    } catch (error) {
        log.error('Error creating summarizer:', error);
        throw error;
    }
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

    try {

        // Clean the text - remove HTML and extra whitespace
        const cleanText = text
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/\s+/g, ' ')     // Normalize whitespace
            .trim();

        if (!cleanText || cleanText.length < 10) {
            log.warn('Text too short to summarize');
            return null;
        }

        log.info('Creating summarizer for headline generation');
        
        // Create summarizer with headline type
        const summarizer = await createSummarizer({
            type: 'headline',
            format: 'plain-text',
            length: 'short', // 12 words max
            sharedContext: context,
            onDownloadProgress
        });

        log.info('Generating headline from text:', cleanText.slice(0, 100));

        // Generate summary
        const headline = await summarizer.summarize(cleanText);
        
        log.info('Raw headline generated:', headline);

        // Clean up the summarizer
        summarizer.destroy();

        // Truncate if needed
        const finalHeadline = headline.length > maxLength 
            ? headline.slice(0, maxLength) + '...'
            : headline;

        log.info('Final headline:', finalHeadline);
        return finalHeadline;

    } catch (error) {
        log.error('Error generating headline:', error);
        return null;
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
    const { context, onDownloadProgress } = options;

    try {

        const cleanText = text
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleanText || cleanText.length < 10) {
            return;
        }

        const summarizer = await createSummarizer({
            type: 'headline',
            format: 'plain-text',
            length: 'short',
            sharedContext: context,
            onDownloadProgress
        });

        const stream = summarizer.summarizeStreaming(cleanText);
        
        for await (const chunk of stream) {
            onChunk(chunk);
        }

        summarizer.destroy();

    } catch (error) {
        log.error('Error in streaming headline generation:', error);
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