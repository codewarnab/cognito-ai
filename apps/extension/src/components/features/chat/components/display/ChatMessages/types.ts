/**
 * ChatMessages Types
 * 
 * Shared type definitions for the ChatMessages component and its sub-components.
 * Centralizing types here prevents circular dependencies and improves maintainability.
 */

import type { Message } from '../../../types';

/**
 * Props for the main ChatMessages component
 * 
 * @property messages - Array of chat messages to display
 * @property isLoading - Whether the AI is currently generating a response
 * @property messagesEndRef - Ref to scroll to bottom of messages
 * @property pendingMessageId - ID of message currently being animated
 * @property isLocalMode - Whether running in local/BYOK mode
 * @property onConfigureApiKey - Callback to open API key configuration
 * @property onContinue - Callback when user clicks "Continue" button
 * @property threadId - Current conversation thread ID
 * @property onQuoteText - Callback to insert quoted text into composer
 * @property addToolOutput - Human-in-the-loop tool approval callback
 * @property onRetry - Callback to retry last failed request
 */
export interface ChatMessagesProps {
    messages: Message[];
    isLoading: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    pendingMessageId?: string | null;
    isLocalMode?: boolean;
    onConfigureApiKey?: () => void;
    onContinue?: () => void;
    threadId?: string | null;
    onQuoteText?: (text: string) => void;
    addToolOutput?: (params: { tool: string; toolCallId: string; output: any }) => void;
    onRetry?: () => void;
}

/**
 * Data structure for image preview modal
 */
export interface ImagePreviewData {
    url: string;
    name: string;
}

/**
 * Props for file attachment rendering
 */
export interface FileAttachmentProps {
    fileParts: any[];
    partIndex: number;
    onPreviewImage: (data: ImagePreviewData) => void;
}

/**
 * Props for tab attachment rendering
 */
export interface TabAttachmentProps {
    tabParts: any[];
    partIndex: number;
}

/**
 * Props for the image preview modal
 */
export interface ImagePreviewModalProps {
    previewImage: ImagePreviewData | null;
    onClose: () => void;
}

/**
 * Props for message part renderer
 */
export interface MessagePartRendererProps {
    part: any;
    partIndex: number;
    message: Message;
    messageIndex: number;
    isLoading: boolean;
    totalMessages: number;
    mergedParts: any[];
    onPreviewImage: (data: ImagePreviewData) => void;
    addToolOutput?: (params: { tool: string; toolCallId: string; output: any }) => void;
    onRetry?: () => void;
}
