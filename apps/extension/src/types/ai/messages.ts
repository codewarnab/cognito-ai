/**
 * Enhanced message types for AI chat
 * 
 * Provides typed message structures for multi-modal AI conversations,
 * including text, images, files, tab context, and tool interactions.
 */

import type { UIMessage } from 'ai';

/** Role of a message participant in the conversation */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** Discriminator types for message content parts */
export type MessagePartType =
    | 'text'
    | 'image'
    | 'file'
    | 'tab-context'
    | 'tool-call'
    | 'tool-result';

/**
 * Plain text content part of a message
 */
export interface TextPart {
    /** Discriminator for message part type */
    type: 'text';
    /** The text content */
    text: string;
}

/**
 * Image content part of a message
 * Supports multiple image data formats
 */
export interface ImagePart {
    /** Discriminator for message part type */
    type: 'image';
    /** Image data as base64 string, Blob, or ArrayBuffer */
    image: string | Blob | ArrayBuffer;
    /** MIME type of the image (e.g., 'image/png') */
    mimeType?: string;
}

/**
 * File attachment part of a message
 */
export interface FilePart {
    /** Discriminator for message part type */
    type: 'file';
    /** Base64-encoded file data */
    data: string;
    /** MIME type of the file */
    mimeType: string;
    /** Original filename */
    filename?: string;
}

/**
 * Browser tab context part of a message
 * Used to provide page context to the AI
 */
export interface TabContextPart {
    /** Discriminator for message part type */
    type: 'tab-context';
    /** URL of the tab */
    url: string;
    /** Page title */
    title: string;
    /** Extracted page content, null if unavailable */
    content: string | null;
    /** Favicon URL */
    favicon?: string;
    /** Error message if content extraction failed */
    error?: string;
}

/**
 * Tool invocation request part of a message
 * Represents an AI request to execute a tool
 */
export interface ToolCallPart {
    /** Discriminator for message part type */
    type: 'tool-call';
    /** Unique identifier for this tool call */
    toolCallId: string;
    /** Name of the tool to invoke */
    toolName: string;
    /** Arguments to pass to the tool */
    args: Record<string, unknown>;
}

/**
 * Tool execution result part of a message
 * Contains the output from a tool invocation
 */
export interface ToolResultPart {
    /** Discriminator for message part type */
    type: 'tool-result';
    /** ID of the corresponding tool call */
    toolCallId: string;
    /** Name of the tool that was invoked */
    toolName: string;
    /** Result returned by the tool */
    result: unknown;
    /** Whether the tool execution resulted in an error */
    isError?: boolean;
}

/**
 * Union type of all possible message content parts
 * Used for discriminated union pattern matching
 */
export type MessagePart =
    | TextPart
    | ImagePart
    | FilePart
    | TabContextPart
    | ToolCallPart
    | ToolResultPart;

/**
 * Metadata associated with a message
 * Contains model info, usage stats, and custom data
 */
export interface MessageMetadata {
    /** ID of the model that generated the response */
    modelId?: string;
    /** Temperature setting used for generation */
    temperature?: number;
    /** Number of tokens consumed */
    tokensUsed?: number;
    /** Time taken to process in milliseconds */
    processingTime?: number;
    /** Additional custom metadata */
    [key: string]: unknown;
}

/**
 * Extended message type with additional metadata
 * Extends the base UIMessage from Vercel AI SDK
 */
export interface EnhancedMessage extends UIMessage {
    /** Optional metadata about the message */
    metadata?: MessageMetadata;
}
