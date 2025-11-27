/**
 * Write Command Types
 * Type definitions for the /write slash command feature
 */

/**
 * Tone options for generated content
 */
export type WriteTone = 'professional' | 'casual' | 'formal' | 'friendly';

/**
 * Attachment data for write command
 * Simplified version of chat attachments - single file focus
 */
export interface WriteAttachment {
    id: string;
    file: File;
    preview?: string; // Base64 preview for images
    type: 'image' | 'document';
    base64Data?: string; // Cached base64 for API call
    mimeType: string;
}

/**
 * Serializable attachment data for messaging
 */
export interface WriteAttachmentPayload {
    base64Data: string;
    mimeType: string;
    fileName: string;
    fileSize: number;
}

/**
 * Supported attachment MIME types for writer
 */
export const WRITER_SUPPORTED_MIME_TYPES = {
    images: ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'] as const,
    documents: ['application/pdf', 'text/plain'] as const,
} as const;

/**
 * Maximum file sizes
 */
export const WRITER_FILE_LIMITS = {
    image: 7 * 1024 * 1024, // 7MB
    document: 20 * 1024 * 1024, // 20MB (keeping under 20MB total request limit)
} as const;

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
            enableUrlContext?: boolean; // Enable URL fetching/analysis tool
            enableGoogleSearch?: boolean; // Enable Google Search grounding tool
            // Supermemory integration
            enableSupermemorySearch?: boolean; // Enable Supermemory semantic search
        };
        // Attachment data (serialized for messaging)
        attachment?: WriteAttachmentPayload;
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
