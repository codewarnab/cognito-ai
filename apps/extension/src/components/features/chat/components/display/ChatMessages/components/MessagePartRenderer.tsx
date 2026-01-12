/**
 * MessagePartRenderer Component
 * 
 * Renders individual message parts based on their type.
 * Handles text, files, tabs, tools, and status parts.
 * 
 * This component centralizes the rendering logic for all message part types,
 * making the main ChatMessages component cleaner and more maintainable.
 */

import React from 'react';
import { renderTextWithMentions } from '@/components/shared/inputs';
import { ToolPartRenderer } from '@/ai/tools/components';
import { CollapsibleUserMessage } from '../../CollapsibleUserMessage';
import { ErrorCardFactory, type ErrorCardData } from '../../../feedback/error-cards';
import { SafeMarkdown } from './SafeMarkdown';
import { FileAttachment } from './FileAttachment';
import { TabAttachment } from './TabAttachment';
import type { Message } from '../../../../types';
import type { ImagePreviewData } from '../types';

interface MessagePartRendererProps {
    /** The message part to render */
    part: any;
    /** Index of this part in the merged parts array */
    partIndex: number;
    /** The parent message containing this part */
    message: Message;
    /** Index of the message in the messages array */
    messageIndex: number;
    /** Whether the AI is currently generating a response */
    isLoading: boolean;
    /** Total number of messages in the conversation */
    totalMessages: number;
    /** All merged parts from this message (for grouping files/tabs) */
    mergedParts: any[];
    /** Callback to open image preview modal */
    onPreviewImage: (data: ImagePreviewData) => void;
    /** Human-in-the-loop tool approval callback */
    addToolOutput?: (params: { tool: string; toolCallId: string; output: any }) => void;
    /** Callback to retry last failed request */
    onRetry?: () => void;
}

/**
 * Renders a single message part based on its type
 * 
 * Supported part types:
 * - `text`: Markdown content (user or assistant)
 * - `file`: File attachments (images, audio, documents)
 * - `tab-context`: Browser tab attachments
 * - `tool-call`/`tool-result`: Tool execution UI
 * - `data-status`: Status/error cards
 * 
 * @returns The rendered part, or null if it should be skipped
 */
export const MessagePartRenderer: React.FC<MessagePartRendererProps> = ({
    part,
    partIndex,
    message,
    messageIndex,
    isLoading,
    totalMessages,
    mergedParts,
    onPreviewImage,
    addToolOutput,
    onRetry,
}) => {
    // ============================================
    // TEXT PARTS
    // ============================================
    if (part.type === 'text' && part.text) {
        // Skip text parts that are tab attachment content (for AI only)
        // These start with [TAB ATTACHMENT: and end with [/TAB ATTACHMENT]
        const isTabAttachmentText = /^\s*\[TAB ATTACHMENT:/i.test(part.text);
        if (isTabAttachmentText) {
            return null; // Don't render internal context text
        }

        // Check if this is the currently streaming message
        const isCurrentlyStreaming = isLoading && messageIndex === totalMessages - 1;

        // ASSISTANT messages: Render with markdown support
        if (message.role === 'assistant') {
            return (
                <div key={`text-${partIndex}`} className="break-words">
                    <div className="markdown-content">
                        <SafeMarkdown isStreaming={isCurrentlyStreaming}>
                            {part.text}
                        </SafeMarkdown>
                    </div>
                </div>
            );
        }

        // USER messages: Render with collapsible wrapper and @mention highlighting
        return (
            <CollapsibleUserMessage
                key={`text-${partIndex}`}
                text={part.text}
                renderContent={(text) => renderTextWithMentions(text)}
            />
        );
    }

    // ============================================
    // FILE ATTACHMENTS
    // ============================================
    if (part.type === 'file') {
        // Check if this is the first file in a sequence
        const fileParts = mergedParts.filter((p: any) => p.type === 'file');
        const isFirstFile = fileParts[0] === part;

        // Only render the container for the first file (groups all files)
        if (!isFirstFile) return null;

        return (
            <FileAttachment
                key={`file-group-${partIndex}`}
                fileParts={fileParts}
                partIndex={partIndex}
                onPreviewImage={onPreviewImage}
            />
        );
    }

    // ============================================
    // TAB CONTEXT ATTACHMENTS
    // ============================================
    if (part.type === 'tab-context') {
        // Check if this is the first tab in a sequence
        const tabParts = mergedParts.filter((p: any) => p.type === 'tab-context');
        const isFirstTab = tabParts[0] === part;

        // Only render the container for the first tab (groups all tabs)
        if (!isFirstTab) return null;

        return (
            <TabAttachment
                key={`tab-group-${partIndex}`}
                tabParts={tabParts}
                partIndex={partIndex}
            />
        );
    }

    // ============================================
    // TOOL PARTS (calls and results)
    // ============================================
    if (
        part.type === 'tool-call' ||
        part.type === 'tool-result' ||
        part.type?.startsWith('tool-') ||
        part.type === 'dynamic-tool'
    ) {
        return (
            <div key={part.toolCallId || `tool-${partIndex}`} className="mt-1 flex flex-col gap-1">
                <ToolPartRenderer
                    part={part}
                    messageId={message.id || `msg-${messageIndex}`}
                    addToolOutput={addToolOutput}
                />
            </div>
        );
    }

    // ============================================
    // DATA STATUS PARTS (including errors)
    // ============================================
    if (part.type === 'data-status') {
        // Render error card for error status
        if (part.data?.status === 'error') {
            const data = part.data as ErrorCardData;
            return (
                <div key={`status-error-${partIndex}`} className="mt-1">
                    <ErrorCardFactory
                        data={data}
                        onRetry={onRetry}
                        isLoading={isLoading}
                    />
                </div>
            );
        }
        // Other status types are metadata - don't render
        return null;
    }

    // ============================================
    // UNKNOWN PART TYPES
    // ============================================
    // Return null for any unrecognized part types
    return null;
};
