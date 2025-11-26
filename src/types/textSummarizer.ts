/**
 * Text Summarizer Types
 * Type definitions for the text selection summarizer feature
 */

/**
 * Summary type options
 * - key-points: Extract main ideas as a bulleted list
 * - tl-dr: Concise 2-3 sentence summary
 * - headline: Single headline capturing the main idea
 * - teaser: Brief teaser to encourage reading the full text
 */
export type SummaryType = 'key-points' | 'tl-dr' | 'headline' | 'teaser';

/**
 * Summary length options
 * Controls the approximate length of the generated summary
 */
export type SummaryLength = 'short' | 'medium' | 'long';

/**
 * Page context information
 * Provides context about the source page for better summaries
 */
export interface PageContext {
    title: string;
    url: string;
    domain: string;
}

/**
 * Request to summarize text
 * Sent from content script to background service worker
 */
export interface SummarizeRequest {
    action: 'SUMMARIZE_REQUEST';
    payload: {
        text: string;
        pageContext: PageContext;
        settings?: {
            summaryType?: SummaryType;
            summaryLength?: SummaryLength;
        };
    };
}

/**
 * Streaming chunk response
 * Sent from background to content script for each text chunk
 */
export interface SummarizeStreamChunk {
    action: 'SUMMARIZE_STREAM_CHUNK';
    text: string;
    done: boolean;
}

/**
 * Error response
 * Sent when summarization fails
 */
export interface SummarizeError {
    action: 'SUMMARIZE_ERROR';
    error: string;
    code?: string;
}

/**
 * Union type for all summarize-related messages
 */
export type SummarizeMessage = SummarizeRequest | SummarizeStreamChunk | SummarizeError;

/**
 * State for the summarizer in the content script
 */
export interface SummarizerState {
    summary: string;
    isLoading: boolean;
    isStreaming: boolean;
    error: string | null;
}

/**
 * Position coordinates for UI elements
 */
export interface SummarizePosition {
    x: number;
    y: number;
}

/**
 * Text selection state
 */
export interface TextSelectionState {
    text: string;
    position: SummarizePosition;
    show: boolean;
}
