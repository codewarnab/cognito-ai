/**
 * Enhanced message types for AI chat
 */

import type { UIMessage } from 'ai';

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type MessagePartType =
    | 'text'
    | 'image'
    | 'file'
    | 'tab-context'
    | 'tool-call'
    | 'tool-result';

export interface TextPart {
    type: 'text';
    text: string;
}

export interface ImagePart {
    type: 'image';
    image: string | Blob | ArrayBuffer;
    mimeType?: string;
}

export interface FilePart {
    type: 'file';
    data: string;
    mimeType: string;
    filename?: string;
}

export interface TabContextPart {
    type: 'tab-context';
    url: string;
    title: string;
    content: string | null;
    favicon?: string;
    error?: string;
}

export interface ToolCallPart {
    type: 'tool-call';
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
}

export interface ToolResultPart {
    type: 'tool-result';
    toolCallId: string;
    toolName: string;
    result: unknown;
    isError?: boolean;
}

export type MessagePart =
    | TextPart
    | ImagePart
    | FilePart
    | TabContextPart
    | ToolCallPart
    | ToolResultPart;

export interface MessageMetadata {
    modelId?: string;
    temperature?: number;
    tokensUsed?: number;
    processingTime?: number;
    [key: string]: unknown;
}

export interface EnhancedMessage extends UIMessage {
    metadata?: MessageMetadata;
}
