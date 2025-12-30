/**
 * Write Command Types
 * Type definitions for the /write slash command feature
 */

/**
 * Tone options for generated content
 */
import type { WritePageContext, WriteTone } from '@cognito/shared/types';

export type { WritePageContext, WriteTone } from '@cognito/shared/types';

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
 * 
 * GEMINI/VERTEX: Supports a wide range of file types including images, PDFs, and text files
 * CLAUDE/OPENAI: Limited to images and PDFs only (based on their API documentation)
 * 
 * @see https://platform.claude.com/docs/en/build-with-claude/vision (Claude images)
 * @see https://platform.claude.com/docs/en/build-with-claude/pdf-support (Claude PDFs)
 * @see https://platform.openai.com/docs/guides/images-vision (OpenAI images)
 * @see https://platform.openai.com/docs/guides/pdf-files (OpenAI PDFs)
 */
export const WRITER_SUPPORTED_MIME_TYPES = {
    // Image types - supported by all providers
    images: ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'image/gif'] as const,
    // Document types - PDF supported by all providers, text/plain only by Gemini/Vertex
    documents: ['application/pdf', 'text/plain'] as const,
} as const;

/**
 * Provider-specific MIME type restrictions
 * Claude and OpenAI only support images + PDFs, not other document types
 */
export const PROVIDER_SUPPORTED_MIME_TYPES = {
    // Gemini and Vertex support all MIME types
    gemini: {
        images: WRITER_SUPPORTED_MIME_TYPES.images,
        documents: WRITER_SUPPORTED_MIME_TYPES.documents,
    },
    vertex: {
        images: WRITER_SUPPORTED_MIME_TYPES.images,
        documents: WRITER_SUPPORTED_MIME_TYPES.documents,
    },
    // OpenAI only supports images and PDFs
    openai: {
        images: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const,
        documents: ['application/pdf'] as const,
    },
    // Anthropic (Claude) only supports images and PDFs
    anthropic: {
        images: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const,
        documents: ['application/pdf'] as const,
    },
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
