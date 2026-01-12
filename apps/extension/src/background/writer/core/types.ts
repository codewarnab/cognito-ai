/**
 * Writer Module Types
 * 
 * Contains all type definitions, interfaces, and constants
 * used throughout the writer module.
 * 
 * @module writer/core/types
 */

import type { WritePageContext, WriteTone } from '@/types';

/**
 * Configuration options for text generation operations.
 * 
 * @interface WriterOptions
 * @property {WriteTone} [tone] - The tone/style to use for generation (e.g., 'professional', 'casual')
 * @property {number} [maxTokens] - Maximum number of tokens to generate (default: 1024)
 * @property {WritePageContext} [pageContext] - Context about the current page for contextual generation
 * @property {boolean} [enableUrlContext] - Enable URL fetching/analysis tool (Gemini only)
 * @property {boolean} [enableGoogleSearch] - Enable Google Search grounding tool
 * @property {boolean} [enableSupermemorySearch] - Enable AI to decide when to search memories
 * @property {AttachmentData} [attachment] - Attached file for multimodal generation
 */
export interface WriterOptions {
    /** The tone/style to use for generation */
    tone?: WriteTone;
    /** Maximum number of tokens to generate */
    maxTokens?: number;
    /** Context about the current page */
    pageContext?: WritePageContext;
    /** Enable URL fetching/analysis tool (Gemini only) */
    enableUrlContext?: boolean;
    /** Enable Google Search grounding tool */
    enableGoogleSearch?: boolean;
    /** Enable AI to decide when to search memories */
    enableSupermemorySearch?: boolean;
    /** Attached file for multimodal generation */
    attachment?: AttachmentData;
}

/**
 * Attachment data for multimodal content generation.
 * Supports images and documents (PDFs).
 * 
 * @interface AttachmentData
 * @property {string} base64Data - Base64 encoded file content
 * @property {string} mimeType - MIME type of the file (e.g., 'image/png', 'application/pdf')
 * @property {string} fileName - Original filename
 * @property {number} fileSize - File size in bytes
 */
export interface AttachmentData {
    /** Base64 encoded file content */
    base64Data: string;
    /** MIME type of the file */
    mimeType: string;
    /** Original filename */
    fileName: string;
    /** File size in bytes */
    fileSize: number;
}

/**
 * Content part for Gemini API request.
 * Supports text and inline binary data (images, documents).
 * 
 * @interface GeminiRequestPart
 */
export interface GeminiRequestPart {
    /** Text content */
    text?: string;
    /** Inline binary data for attachments */
    inlineData?: {
        /** MIME type of the data */
        mimeType: string;
        /** Base64 encoded data */
        data: string;
    };
}

/**
 * Content part used in Gemini API conversations.
 * Extends GeminiRequestPart with function response support.
 * 
 * @interface GeminiContentPart
 */
export interface GeminiContentPart extends GeminiRequestPart {
    /** Function response for tool calling */
    functionResponse?: {
        /** Name of the function that was called */
        name: string;
        /** Response from the function */
        response: unknown;
    };
}

/**
 * OpenAI-compatible message content part.
 * Used for both OpenAI and xAI providers.
 * 
 * @interface OpenAIContentPart
 */
export interface OpenAIContentPart {
    /** Type of content (text, image_url, file) */
    type: 'text' | 'image_url' | 'file';
    /** Text content (for type: 'text') */
    text?: string;
    /** Image URL data (for type: 'image_url') */
    image_url?: {
        /** Data URL or HTTP URL */
        url: string;
    };
    /** File data (for type: 'file') */
    file?: {
        /** Original filename */
        filename: string;
        /** Base64 data URL */
        file_data: string;
    };
}

/**
 * Anthropic/Claude message content part.
 * Supports text, images, and documents.
 * 
 * @interface AnthropicContentPart
 */
export interface AnthropicContentPart {
    /** Type of content (text, image, document) */
    type: 'text' | 'image' | 'document';
    /** Text content (for type: 'text') */
    text?: string;
    /** Source data (for type: 'image' or 'document') */
    source?: {
        /** Source type (always 'base64' for attachments) */
        type: 'base64';
        /** MIME type of the content */
        media_type: string;
        /** Base64 encoded data */
        data: string;
    };
}

/**
 * OpenAI-compatible message structure.
 * Used for conversation history in OpenAI and xAI providers.
 * 
 * @interface OpenAIMessage
 */
export interface OpenAIMessage {
    /** Role of the message sender */
    role: 'system' | 'user' | 'assistant' | 'tool';
    /** Message content (string or array of content parts) */
    content: string | OpenAIContentPart[];
    /** Tool call ID (for tool role messages) */
    tool_call_id?: string;
}

/**
 * Anthropic/Claude message structure.
 * 
 * @interface AnthropicMessage
 */
export interface AnthropicMessage {
    /** Role of the message sender */
    role: 'user' | 'assistant';
    /** Message content (array of content parts) */
    content: AnthropicContentPart[] | AnthropicToolResult[];
}

/**
 * Anthropic tool result content block.
 * 
 * @interface AnthropicToolResult
 */
export interface AnthropicToolResult {
    /** Type is always 'tool_result' */
    type: 'tool_result';
    /** ID of the tool use this is responding to */
    tool_use_id: string;
    /** Result content */
    content: string;
    /** Whether the tool execution errored */
    is_error?: boolean;
}

/**
 * Gemini conversation message structure.
 * 
 * @interface GeminiMessage
 */
export interface GeminiMessage {
    /** Role of the message sender */
    role: 'user' | 'model';
    /** Message content parts */
    parts: GeminiContentPart[];
}

/**
 * Maximum number of function call iterations allowed
 * to prevent infinite loops in tool calling.
 * 
 * @constant
 */
export const MAX_FUNCTION_CALLS = 3;

/**
 * Default maximum tokens for generation.
 * 
 * @constant
 */
export const DEFAULT_MAX_TOKENS = 1024;

/**
 * Default temperature for generation.
 * 
 * @constant
 */
export const DEFAULT_TEMPERATURE = 0.7;

/**
 * Default top-p value for generation.
 * 
 * @constant
 */
export const DEFAULT_TOP_P = 0.95;
