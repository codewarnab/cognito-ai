/**
 * Rewrite Command Types
 * Type definitions for the text rewrite feature (select text → rewrite)
 */

/**
 * Preset rewrite options
 */
export type RewritePreset =
    | 'shorter'
    | 'longer'
    | 'professional'
    | 'casual'
    | 'improve'
    | 'simplify'
    | 'enthusiastic'
    | 'conversational';

/**
 * Page context for rewrite operations
 */
export interface RewritePageContext {
    title: string;
    url: string;
    domain: string;
}

/**
 * Request to rewrite text
 * Sent from content script to background service worker
 */
export interface RewriteRequest {
    action: 'REWRITE_REQUEST';
    payload: {
        selectedText: string;
        instruction: string;
        preset?: RewritePreset;
        pageContext?: RewritePageContext;
        // Gemini Tool settings
        enableUrlContext?: boolean;
        enableGoogleSearch?: boolean;
    };
}

/**
 * Complete response (non-streaming)
 * Sent when rewrite is complete
 */
export interface RewriteResponse {
    action: 'REWRITE_COMPLETE';
    text: string;
}

/**
 * Error response
 * Sent when rewrite fails
 */
export interface RewriteError {
    action: 'REWRITE_ERROR';
    error: string;
    code?: string;
}

/**
 * Union type for all rewrite-related messages
 */
export type RewriteMessage = RewriteRequest | RewriteResponse | RewriteError;

/**
 * State for the rewriter in the content script
 */
export interface RewriterState {
    rewrittenText: string;
    isProcessing: boolean;
    error: string | null;
}

/**
 * Selection data captured from the page
 */
export interface RewriteSelectionData {
    text: string;
    range: Range;
    position: { x: number; y: number };
    targetElement?: HTMLElement;
}
