import React, { useMemo, useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { renderTextWithMentions } from '@/components/shared/inputs';
import { ToolPartRenderer } from '@/ai/tools/components';
import type { Message } from '../../types';
import { getMessageContent, hasToolCalls, hasAttachments } from '../../utils';
import { EmptyState } from '../states/EmptyState';
import { LoadingIndicator } from '../feedback/LoadingIndicator';
import { ContinueButton } from '../buttons/ContinueButton';
import { CopyButton } from '../buttons/CopyButton';
import { getFileIcon } from '@/utils/files';
import { StreamdownRenderer } from './StreamdownRenderer';
import { XIcon } from '@assets/icons/chat/x';
import { useInlineCodeEnhancer } from '@/hooks/useInlineCodeEnhancer';

// Error Boundary for Markdown rendering (kept as safety net)
class MarkdownErrorBoundary extends React.Component<
    { children: React.ReactNode; fallback: string },
    { hasError: boolean }
> {
    constructor(props: { children: React.ReactNode; fallback: string }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    override componentDidCatch() {
        console.warn('Markdown rendering error');
    }

    override render() {
        if (this.state.hasError) {
            return <div className="markdown-fallback">{this.props.fallback}</div>;
        }
        return this.props.children;
    }
}

interface SafeMarkdownProps {
    children: string;
    isStreaming?: boolean;
}

// Safe markdown wrapper using Streamdown for better streaming support
const SafeMarkdown: React.FC<SafeMarkdownProps> = ({ children, isStreaming = false }) => {
    return (
        <MarkdownErrorBoundary fallback={children}>
            <StreamdownRenderer isAnimating={isStreaming}>
                {children}
            </StreamdownRenderer>
        </MarkdownErrorBoundary>
    );
};

interface ChatMessagesProps {
    messages: Message[];
    isLoading: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    pendingMessageId?: string | null;
    isLocalMode?: boolean;
    onConfigureApiKey?: () => void;
    onContinue?: () => void; // Callback to send continue message
    threadId?: string | null; // Current thread ID for brain button
}

/**
 * Merge tool-call and tool-result parts by toolCallId
 * This prevents showing both loading and success icons for the same tool execution
 * 
 * For MCP tools with longer wait times, this ensures:
 * - tool-call shows loading state (no result yet)
 * - tool-result shows success state (execution complete)
 * - Only the latest state is displayed
 */
function mergeToolParts(parts: any[]): any[] {
    const toolMap = new Map<string, any>();
    const mergedParts: any[] = [];

    for (const part of parts) {
        // Handle text parts - always include
        if (part.type === 'text') {
            mergedParts.push(part);
            continue;
        }

        // Handle tool parts - merge by toolCallId
        if (
            part.type === 'tool-call' ||
            part.type === 'tool-result' ||
            part.type?.startsWith('tool-') ||
            part.type === 'dynamic-tool'
        ) {
            const toolCallId = part.toolCallId;

            if (!toolCallId) {
                // No ID, can't merge - just add it
                mergedParts.push(part);
                continue;
            }

            // Check if we've seen this tool before
            const existingTool = toolMap.get(toolCallId);

            if (!existingTool) {
                // First time seeing this tool - store it
                toolMap.set(toolCallId, part);
                mergedParts.push(part);
            } else {
                // We've seen this tool before - merge the parts
                // tool-result should override tool-call
                if (part.type === 'tool-result') {
                    // Replace the existing part with the result
                    const index = mergedParts.indexOf(existingTool);
                    if (index !== -1) {
                        // Merge input from tool-call with output from tool-result
                        const mergedPart = {
                            ...part,
                            args: existingTool.args || part.args,
                            input: existingTool.input || part.input,
                        };
                        mergedParts[index] = mergedPart;
                        toolMap.set(toolCallId, mergedPart);
                    }
                } else if (existingTool.type === 'tool-call' && part.type === 'tool-call') {
                    // Multiple tool-calls with same ID - keep the first one
                    continue;
                }
            }
            continue;
        }

        // Other part types - include as-is
        mergedParts.push(part);
    }

    return mergedParts;
}

/**
 * Extract text content from a message for copying
 */
function extractMessageText(message: Message): string {
    if (!message.parts || message.parts.length === 0) {
        return '';
    }

    const textParts = message.parts
        .filter((part: any) => part.type === 'text' && part.text)
        .map((part: any) => part.text);

    return textParts.join('\n\n');
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({
    messages,
    isLoading,
    messagesEndRef,
    pendingMessageId,
    isLocalMode,
    onConfigureApiKey,
    onContinue,
    threadId,
}) => {
    const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

    // Ref for the messages container - used for inline code enhancement
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Enhance inline code elements with click-to-copy and URL opening
    useInlineCodeEnhancer(messagesContainerRef, isLoading);

    // Listen for custom events from screenshot tool
    useEffect(() => {
        const handleOpenImagePreview = (event: CustomEvent) => {
            setPreviewImage(event.detail);
        };

        window.addEventListener('openImagePreview' as any, handleOpenImagePreview);
        return () => {
            window.removeEventListener('openImagePreview' as any, handleOpenImagePreview);
        };
    }, []);

    // Notify when preview state changes (for hiding voice pill)
    useEffect(() => {
        const event = new CustomEvent('imagePreviewStateChange', {
            detail: { isOpen: !!previewImage }
        });
        window.dispatchEvent(event);
    }, [previewImage]);

    // Check if the last message has continue-available status
    const showContinueButton = useMemo(() => {
        if (isLoading || messages.length === 0) return false;

        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'assistant') return false;

        // Check if any part has continue-available status
        const hasContinueStatus = lastMessage.parts?.some((part: any) =>
            part.type === 'data-status' &&
            part.data?.status === 'continue-available'
        );

        return hasContinueStatus;
    }, [messages, isLoading]);

    return (
        <div className="copilot-messages" ref={messagesContainerRef}>{messages.length === 0 ? (
            <EmptyState isLocalMode={isLocalMode} onConfigureApiKey={onConfigureApiKey} />
        ) : (
            <AnimatePresence>
                {messages
                    .filter(message => {
                        // Filter out internal messages (tab context)
                        if ((message as any).metadata?.internal) {
                            return false;
                        }
                        const content = getMessageContent(message);
                        const hasText = typeof content === 'string' && content.trim().length > 0;
                        const hasTools = hasToolCalls(message);
                        const hasFiles = hasAttachments(message);

                        // Show message if it has text OR tool calls OR attachments
                        return hasText || hasTools || hasFiles;
                    })
                    .map((message, index) => {
                        // Check if this is the pending message (currently animating)
                        const isPendingMessage = message.role === 'user' && message.id === pendingMessageId;

                        return (
                            <motion.div
                                key={message.id || index}
                                layout="position"
                                layoutId={isPendingMessage ? `message-${pendingMessageId}` : undefined}
                                transition={{ type: 'easeOut', duration: 0.2 }}
                                initial={isPendingMessage ? { opacity: 0 } : undefined}
                                animate={isPendingMessage ? { opacity: 1 } : undefined}
                                className={`copilot-message copilot-message-${message.role}`}
                            >
                                <div className={`copilot-message-bubble copilot-message-bubble-${message.role} ${hasToolCalls(message) ? 'copilot-message-bubble-no-bg' : ''}`}>
                                    {/* Render parts in their actual order - text and tools interleaved */}
                                    {message.parts && message.parts.length > 0 && (() => {
                                        // Merge tool-call and tool-result parts to avoid duplicate rendering
                                        const mergedParts = mergeToolParts(message.parts);

                                        return (
                                            <div className="message-parts">
                                                {mergedParts.map((part: any, partIndex: number) => {
                                                    // Render text parts (but skip tab attachment text parts)
                                                    if (part.type === 'text' && part.text) {
                                                        // Skip text parts that are tab attachment content (for AI only)
                                                        // These start with [TAB ATTACHMENT: and end with [/TAB ATTACHMENT]
                                                        const isTabAttachmentText = /^\s*\[TAB ATTACHMENT:/i.test(part.text);
                                                        if (isTabAttachmentText) {
                                                            return null; // Don't render this text part
                                                        }

                                                        const isCurrentlyStreaming = isLoading && index === messages.length - 1;
                                                        return (
                                                            <div key={`text-${partIndex}`} className="copilot-message-content">
                                                                {message.role === 'assistant' ? (
                                                                    <div className="markdown-content">
                                                                        <SafeMarkdown isStreaming={isCurrentlyStreaming}>
                                                                            {part.text}
                                                                        </SafeMarkdown>
                                                                    </div>
                                                                ) : (
                                                                    <div className="user-message-with-mentions">
                                                                        {renderTextWithMentions(part.text)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    }

                                                    // Render file attachments - group them together
                                                    if (part.type === 'file') {
                                                        // Check if this is the first file in a sequence
                                                        const fileParts = mergedParts.filter((p: any) => p.type === 'file');
                                                        const isFirstFile = fileParts[0] === part;

                                                        // Only render the container for the first file
                                                        if (!isFirstFile) return null;

                                                        const totalFiles = fileParts.length;
                                                        const firstFile = fileParts[0];
                                                        const remainingCount = totalFiles - 1;
                                                        const isImage = firstFile.mediaType?.startsWith('image/');

                                                        return (
                                                            <div key={`file-group-${partIndex}`} className="message-file-attachments-group">
                                                                <div className="message-file-attachment">
                                                                    {isImage ? (
                                                                        <div
                                                                            className="message-file-image"
                                                                            onClick={() => setPreviewImage({ url: firstFile.url, name: firstFile.name || 'Image' })}
                                                                        >
                                                                            <img src={firstFile.url} alt={firstFile.name || 'Attached image'} />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="message-file-document">
                                                                            <div className="file-attachment-icon">
                                                                                {getFileIcon(firstFile.name || 'file', 24)}
                                                                            </div>
                                                                            <span className="file-attachment-name" title={firstFile.name}>
                                                                                {firstFile.name || 'Document'}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {remainingCount > 0 && (
                                                                    <div className="message-file-attachment-overlay">
                                                                        +{remainingCount}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    }

                                                    // Render tab attachments - group them together
                                                    if (part.type === 'tab-context') {
                                                        // Check if this is the first tab in a sequence
                                                        const tabParts = mergedParts.filter((p: any) => p.type === 'tab-context');
                                                        const isFirstTab = tabParts[0] === part;

                                                        // Only render the container for the first tab
                                                        if (!isFirstTab) return null;

                                                        const totalTabs = tabParts.length;
                                                        const firstTab = tabParts[0];
                                                        const remainingCount = totalTabs - 1;

                                                        return (
                                                            <div key={`tab-group-${partIndex}`} className="message-tab-attachments-group">
                                                                <div className="message-tab-attachment">
                                                                    <div className="tab-attachment-icon">
                                                                        {firstTab.favicon ? (
                                                                            <img
                                                                                src={firstTab.favicon}
                                                                                alt=""
                                                                                className="tab-favicon"
                                                                            />
                                                                        ) : (
                                                                            <div className="tab-favicon-placeholder">🌐</div>
                                                                        )}
                                                                    </div>
                                                                    <div className="tab-attachment-info">
                                                                        <div className="tab-attachment-title" title={firstTab.title}>
                                                                            {firstTab.title}
                                                                        </div>
                                                                        <div className="tab-attachment-url" title={firstTab.url}>
                                                                            {firstTab.url}
                                                                        </div>
                                                                        {firstTab.error && (
                                                                            <div className="tab-attachment-error">
                                                                                ⚠️ {firstTab.error}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {remainingCount > 0 && (
                                                                    <div className="message-tab-attachment-overlay">
                                                                        +{remainingCount}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    }

                                                    // Render tool parts
                                                    if (
                                                        part.type === 'tool-call' ||
                                                        part.type === 'tool-result' ||
                                                        part.type?.startsWith('tool-') ||
                                                        part.type === 'dynamic-tool'
                                                    ) {
                                                        return (
                                                            <div key={part.toolCallId || `tool-${partIndex}`} className="message-tools">
                                                                <ToolPartRenderer
                                                                    part={part}
                                                                    messageId={message.id || `msg-${index}`}
                                                                />
                                                            </div>
                                                        );
                                                    }

                                                    // Skip rendering data-status parts (they're metadata)
                                                    if (part.type === 'data-status') {
                                                        return null;
                                                    }

                                                    // Unknown part type
                                                    return null;
                                                })}

                                                {/* Add copy button for assistant messages - only show after streaming is finished */}
                                                {message.role === 'assistant' && extractMessageText(message) && !(isLoading && index === messages.length - 1) && (() => {
                                                    // Find the previous user message for context
                                                    const filteredMessages = messages.filter(m => !(m as any).metadata?.internal);
                                                    const currentIndex = filteredMessages.findIndex(m => m.id === message.id);
                                                    const previousUserMessage = currentIndex > 0
                                                        ? filteredMessages.slice(0, currentIndex).reverse().find(m => m.role === 'user')
                                                        : undefined;
                                                    const previousMessageText = previousUserMessage ? extractMessageText(previousUserMessage) : undefined;

                                                    return (
                                                        <CopyButton
                                                            content={extractMessageText(message)}
                                                            previousMessage={previousMessageText}
                                                            threadId={threadId ?? undefined}
                                                        />
                                                    );
                                                })()}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </motion.div>
                        );
                    })}
            </AnimatePresence>
        )}

            {/* Continue Button - shown when AI hits step count limit */}
            {showContinueButton && onContinue && (
                <ContinueButton onContinue={onContinue} isLoading={isLoading} />
            )}

            {/* Loading Indicator - only show when loading AND assistant hasn't started streaming content yet */}
            {isLoading && (() => {
                // Check if the last message is from the assistant AND has actual content
                const lastMessage = messages[messages.length - 1];
                if (lastMessage?.role !== 'assistant') {
                    // No assistant message yet - show loading
                    return true;
                }
                // Check if assistant message has any actual content (text or tool calls)
                const hasContent = lastMessage.parts?.some((part: any) =>
                    (part.type === 'text' && part.text?.trim()) ||
                    part.type === 'tool-call' ||
                    part.type === 'tool-result'
                );
                // Only show loading if assistant message has no content yet
                return !hasContent;
            })() && <LoadingIndicator />}

            <div ref={messagesEndRef as React.RefObject<HTMLDivElement>} />

            {/* Image Preview Modal */}
            <AnimatePresence>
                {previewImage && (
                    <motion.div
                        className="message-image-preview-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setPreviewImage(null)}
                    >
                        <button
                            className="message-image-preview-close"
                            onClick={() => setPreviewImage(null)}
                            aria-label="Close preview"
                        >
                            <XIcon size={20} />
                        </button>
                        <motion.div
                            className="message-image-preview-container"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img src={previewImage.url} alt={previewImage.name} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
