/**
 * Write Command Types
 * Type definitions for the /write slash command feature
 */

/**
 * Tone options for generated content
 */
export type WriteTone = 'professional' | 'casual' | 'formal' | 'friendly';

/**
 * Page context information
 * Provides context about the current page for better writing suggestions
 */
export interface WritePageContext {
    title: string;
    url: string;
    domain: string;
    platform?: string;
    fieldType?: string;
}

/**
 * Request to generate text
 * Sent from content script to background service worker
 */
export interface WriteGenerateRequest {
    action: 'WRITE_GENERATE';
    payload: {
        prompt: string;
        pageContext?: WritePageContext;
        settings?: {
            tone?: WriteTone;
            maxTokens?: number;
            // Gemini Tool settings
            enableUrlContext?: boolean;    // Enable URL fetching/analysis tool
            enableGoogleSearch?: boolean;  // Enable Google Search grounding tool
        };
    };
}

/**
 * Streaming chunk response
 * Sent from background to content script for each text chunk
 */
export interface WriteStreamChunk {
    action: 'WRITE_STREAM_CHUNK';
    text: string;
    done: boolean;
}

/**
 * Error response
 * Sent when text generation fails
 */
export interface WriteError {
    action: 'WRITE_ERROR';
    error: string;
    code?: string;
}

/**
 * Union type for all write-related messages
 */
export type WriteMessage = WriteGenerateRequest | WriteStreamChunk | WriteError;

/**
 * State for the writer in the content script
 */
export interface WriterState {
    generatedText: string;
    isLoading: boolean;
    isStreaming: boolean;
    error: string | null;
}

/**
 * Position coordinates for UI elements
 */
export interface WritePosition {
    x: number;
    y: number;
}

/**
 * Writer mode state
 */
export interface WriterModeState {
    isActive: boolean;
    targetElement: HTMLElement | null;
    cursorPosition: number;
    position: WritePosition;
}
