/**
 * Ask Command Types
 * Type definitions for the /ask slash command feature
 */

/**
 * Single message in the ask conversation
 */
export interface AskMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    /** For user messages with attachments */
    attachment?: AskAttachmentPayload;
}

/**
 * Attachment data for ask command
 */
export interface AskAttachment {
    id: string;
    file: File;
    preview?: string;
    type: 'image' | 'document';
    base64Data?: string;
    mimeType: string;
}

/**
 * Serializable attachment data for messaging
 */
export interface AskAttachmentPayload {
    base64Data: string;
    mimeType: string;
    fileName: string;
    fileSize: number;
}

/**
 * Supported attachment MIME types for ask command
 */
export const ASK_SUPPORTED_MIME_TYPES = {
    images: ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'] as const,
    documents: ['application/pdf', 'text/plain'] as const,
} as const;

/**
 * Maximum file sizes for ask command
 */
export const ASK_FILE_LIMITS = {
    image: 7 * 1024 * 1024,
    document: 20 * 1024 * 1024,
} as const;


/**
 * Enhanced page context for /ask (more comprehensive than /write)
 */
export interface AskPageContext {
    title: string;
    url: string;
    domain: string;
    platform?: string;
    /** User's selected text on page */
    selectedText?: string;
    /** Extracted visible text content (truncated) */
    visibleContent?: string;
    /** Page meta description */
    metaDescription?: string;
}

/**
 * Request to generate an answer
 * Sent from content script to background service worker
 */
export interface AskGenerateRequest {
    action: 'ASK_GENERATE';
    payload: {
        question: string;
        conversationHistory: AskMessage[];
        pageContext?: AskPageContext;
        settings?: {
            maxTokens?: number;
            enableUrlContext?: boolean;
            enableGoogleSearch?: boolean;
            enableSupermemorySearch?: boolean;
        };
        attachment?: AskAttachmentPayload;
    };
}

/**
 * Streaming chunk response
 */
export interface AskStreamChunk {
    action: 'ASK_STREAM_CHUNK';
    text: string;
    done: boolean;
}

/**
 * Error response
 */
export interface AskError {
    action: 'ASK_ERROR';
    error: string;
    code?: string;
}

/**
 * Union type for all ask-related port messages
 */
export type AskPortMessage = AskGenerateRequest | AskStreamChunk | AskError;

/**
 * Position coordinates for UI overlay
 */
export interface AskPosition {
    x: number;
    y: number;
}

/**
 * Ask mode state
 */
export interface AskModeState {
    isActive: boolean;
    targetElement: HTMLElement | null;
    position: AskPosition;
}

/**
 * Conversation state
 */
export interface AskConversationState {
    messages: AskMessage[];
    isGenerating: boolean;
    error: string | null;
}
