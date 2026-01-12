/**
 * ChatMessages Component
 * 
 * Main component for rendering the chat message list.
 * Handles message display, scrolling, user interactions, and visual feedback.
 * 
 * This is the refactored version split into smaller sub-components and utilities:
 * - ./utils/         - Utility functions (mergeToolParts, extractMessageText, processMessages)
 * - ./components/    - Sub-components (SafeMarkdown, FileAttachment, etc.)
 * - ./types.ts       - TypeScript interfaces
 * 
 * Architecture Overview:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ ChatMessages (this file)                                     │
 * │  ├── Message Processing (processMessages utility)           │
 * │  ├── Empty State                                            │
 * │  ├── Message List                                           │
 * │  │   ├── User Messages (CollapsibleUserMessage)             │
 * │  │   └── Assistant Messages                                 │
 * │  │       ├── Text (SafeMarkdown)                           │
 * │  │       ├── Files (FileAttachment)                        │
 * │  │       ├── Tabs (TabAttachment)                          │
 * │  │       ├── Tools (ToolPartRenderer)                      │
 * │  │       └── Errors (ErrorCardFactory)                     │
 * │  ├── Continue Button                                        │
 * │  ├── Loading Indicator                                      │
 * │  ├── Quote Popover                                          │
 * │  └── Image Preview Modal                                    │
 * └─────────────────────────────────────────────────────────────┘
 */

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import '@/styles/components/chat-scrollbar.css';
import { AnimatePresence, motion } from 'motion/react';

// Types
import type { ChatMessagesProps, ImagePreviewData } from './types';

// Utilities
import { mergeToolParts, extractMessageText, processMessages } from './utils';
import { getMessageContent, hasToolCalls, hasAttachments } from '../../../utils';

// Sub-components (from refactored structure)
import { MessagePartRenderer, ImagePreviewModal } from './components';

// Shared components
import { EmptyState } from '../../states/EmptyState';
import { LoadingIndicator } from '../../feedback/LoadingIndicator';
import { ContinueButton } from '../../buttons/ContinueButton';
import { CopyButton } from '../../buttons/CopyButton';
import { UserMessageCopyButton } from '../../buttons/UserMessageCopyButton';
import { QuotePopover } from '../QuotePopover';

// Hooks
import { useInlineCodeEnhancer } from '@/hooks/useInlineCodeEnhancer';
import { useMessageTextSelection } from '@/hooks/chat';

/**
 * ChatMessages - Main chat message list component
 * 
 * Responsibilities:
 * 1. Process and deduplicate messages (AI SDK v6 bug workaround)
 * 2. Render messages with proper styling based on role (user/assistant)
 * 3. Handle file/tab attachments and tool calls
 * 4. Manage image preview modal
 * 5. Enable text selection for quoting
 * 6. Show loading/continue states
 * 
 * @example
 * ```tsx
 * <ChatMessages
 *   messages={chatMessages}
 *   isLoading={isGenerating}
 *   messagesEndRef={scrollRef}
 *   onContinue={handleContinue}
 *   onQuoteText={handleQuote}
 * />
 * ```
 */
export const ChatMessages: React.FC<ChatMessagesProps> = ({
    messages,
    isLoading,
    messagesEndRef,
    pendingMessageId,
    isLocalMode,
    onConfigureApiKey,
    onContinue,
    threadId,
    onQuoteText,
    addToolOutput,
    onRetry,
}) => {
    // ============================================
    // STATE
    // ============================================
    const [previewImage, setPreviewImage] = useState<ImagePreviewData | null>(null);

    // ============================================
    // REFS
    // ============================================
    // Container ref for inline code enhancement and text selection
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // ============================================
    // HOOKS
    // ============================================
    // Enhance inline code elements with click-to-copy and URL opening
    useInlineCodeEnhancer(messagesContainerRef, isLoading);

    // Text selection for quoting messages
    const textSelection = useMessageTextSelection(messagesContainerRef);

    // ============================================
    // CALLBACKS
    // ============================================

    /**
     * Handle quote action - format selected text as blockquote
     * Prefixes each line with "> " for markdown blockquote format
     */
    const handleQuote = useCallback((text: string) => {
        if (!onQuoteText) return;
        const quotedText = text
            .split('\n')
            .map(line => `> ${line}`)
            .join('\n');
        onQuoteText(quotedText + '\n\n');
    }, [onQuoteText]);

    /**
     * Handle image preview from custom events (e.g., screenshot tool)
     */
    const handlePreviewImage = useCallback((data: ImagePreviewData) => {
        setPreviewImage(data);
    }, []);

    /**
     * Close the image preview modal
     */
    const handleClosePreview = useCallback(() => {
        setPreviewImage(null);
    }, []);

    // ============================================
    // EFFECTS
    // ============================================

    /**
     * Listen for custom events from screenshot tool
     * Allows tools to trigger image preview programmatically
     */
    useEffect(() => {
        const handleOpenImagePreview = (event: CustomEvent<ImagePreviewData>) => {
            setPreviewImage(event.detail);
        };

        window.addEventListener('openImagePreview' as any, handleOpenImagePreview);
        return () => {
            window.removeEventListener('openImagePreview' as any, handleOpenImagePreview);
        };
    }, []);

    /**
     * Notify other components when preview state changes
     * Used for hiding voice pill during preview
     */
    useEffect(() => {
        const event = new CustomEvent('imagePreviewStateChange', {
            detail: { isOpen: !!previewImage }
        });
        window.dispatchEvent(event);
    }, [previewImage]);

    /**
     * Handle ESC key to close image preview
     */
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && previewImage) {
                setPreviewImage(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [previewImage]);

    // ============================================
    // MEMOIZED VALUES
    // ============================================

    /**
     * Check if "Continue" button should be shown
     * Shows when AI hits step count limit (max_steps reached)
     */
    const showContinueButton = useMemo(() => {
        if (isLoading || messages.length === 0) return false;

        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'assistant') return false;

        // Check if any part has continue-available status
        return lastMessage.parts?.some((part: any) =>
            part.type === 'data-status' &&
            part.data?.status === 'continue-available'
        );
    }, [messages, isLoading]);

    /**
     * Process messages to deduplicate assistant messages
     * Handles AI SDK v6 bug where duplicate messages are created
     */
    const processedMessages = useMemo(() => processMessages(messages), [messages]);

    // ============================================
    // RENDER
    // ============================================
    return (
        <div
            className="chat-messages-container flex-1 overflow-y-auto overflow-x-hidden pr-1 pl-4 pb-6 pt-16 flex flex-col gap-3 bg-[#0a0e1a] min-h-0 relative"
            ref={messagesContainerRef}
        >
            {/* Quote popover for text selection */}
            <QuotePopover selection={textSelection} onQuote={handleQuote} />

            {/* Empty state when no messages */}
            {messages.length === 0 ? (
                <EmptyState isLocalMode={isLocalMode} onConfigureApiKey={onConfigureApiKey} />
            ) : (
                <AnimatePresence>
                    {processedMessages
                        // Filter out internal/non-renderable messages
                        .filter(message => {
                            // Filter out internal messages (tab context injected by system)
                            if (message.metadata?.internal) return false;

                            // Check what content this message has
                            const content = getMessageContent(message);
                            const hasText = typeof content === 'string' && content.trim().length > 0;
                            const hasTools = hasToolCalls(message);
                            const hasFiles = hasAttachments(message);
                            const hasRenderableStatus = message.parts?.some((part: any) =>
                                part?.type === 'data-status' && part?.data?.status === 'error'
                            );

                            // Show message if it has any renderable content
                            return hasText || hasTools || hasFiles || hasRenderableStatus;
                        })
                        .map((message, index) => {
                            // Check if this is the pending message (animation in progress)
                            const isPendingMessage = message.role === 'user' && message.id === pendingMessageId;

                            // Merge tool parts to prevent duplicate loading/success states
                            const mergedParts = mergeToolParts(message.parts || []);

                            return (
                                <motion.div
                                    key={message.id || index}
                                    layout="position"
                                    layoutId={isPendingMessage ? `message-${pendingMessageId}` : undefined}
                                    transition={{ ease: 'easeOut', duration: 0.2 }}
                                    initial={isPendingMessage ? { opacity: 0 } : undefined}
                                    animate={isPendingMessage ? { opacity: 1 } : undefined}
                                    className={`flex gap-3 max-w-full group ${message.role === 'user'
                                            ? 'justify-end items-start gap-3 ml-auto pr-1'
                                            : 'justify-start items-start pr-2'
                                        }`}
                                >
                                    {/* Message bubble container */}
                                    <div
                                        className={`rounded-xl px-3 py-2 max-w-[90%] text-sm leading-relaxed break-words ${message.role === 'user'
                                                ? 'bg-blue-500 text-white ml-auto shadow-[0_2px_8px_var(--message-user-shadow)] rounded-br-none'
                                                : hasToolCalls(message)
                                                    ? 'bg-transparent !p-0'
                                                    : 'bg-transparent !text-[var(--text-primary)] !border-none !shadow-none !p-0 !rounded-none !max-w-full !text-sm'
                                            }`}
                                    >
                                        {/* Render all message parts */}
                                        {mergedParts.length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                {mergedParts.map((part: any, partIndex: number) => (
                                                    <MessagePartRenderer
                                                        key={part.toolCallId || `part-${partIndex}`}
                                                        part={part}
                                                        partIndex={partIndex}
                                                        message={message}
                                                        messageIndex={index}
                                                        isLoading={isLoading}
                                                        totalMessages={processedMessages.length}
                                                        mergedParts={mergedParts}
                                                        onPreviewImage={handlePreviewImage}
                                                        addToolOutput={addToolOutput}
                                                        onRetry={onRetry}
                                                    />
                                                ))}

                                                {/* Copy button for assistant messages (after streaming ends) */}
                                                {message.role === 'assistant' &&
                                                    extractMessageText(message) &&
                                                    !(isLoading && index === processedMessages.length - 1) && (() => {
                                                        // Find previous user message for copy context
                                                        const filteredMessages = messages.filter(m => !m.metadata?.internal);
                                                        const currentIndex = filteredMessages.findIndex(m => m.id === message.id);
                                                        const previousUserMessage = currentIndex > 0
                                                            ? filteredMessages.slice(0, currentIndex).reverse().find(m => m.role === 'user')
                                                            : undefined;
                                                        const previousMessageText = previousUserMessage
                                                            ? extractMessageText(previousUserMessage)
                                                            : undefined;

                                                        return (
                                                            <CopyButton
                                                                content={extractMessageText(message)}
                                                                previousMessage={previousMessageText}
                                                                threadId={threadId ?? undefined}
                                                            />
                                                        );
                                                    })()}
                                            </div>
                                        )}
                                    </div>

                                    {/* Copy button for user messages (left of bubble) */}
                                    {message.role === 'user' && extractMessageText(message) && (
                                        <div className="flex items-center opacity-0 transition-opacity duration-150 flex-shrink-0 pt-2 order-[-1] group-hover:opacity-100">
                                            <UserMessageCopyButton content={extractMessageText(message)} />
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                </AnimatePresence>
            )}

            {/* Continue Button - shown when AI hits step count limit */}
            {showContinueButton && onContinue && (
                <ContinueButton onContinue={onContinue} isLoading={isLoading} />
            )}

            {/* Loading Indicator - only when no content has streamed yet */}
            {isLoading && (() => {
                const lastMessage = messages[messages.length - 1];
                // Show loading if no assistant message yet
                if (lastMessage?.role !== 'assistant') return true;
                // Show loading if assistant message has no content yet
                const hasContent = lastMessage.parts?.some((part: any) => {
                    if (part?.type === 'text' && part.text?.trim()) return true;

                    // Tool parts (AI SDK v6 + legacy)
                    if (part?.type === 'tool-call' || part?.type === 'tool-result') return true;
                    if (part?.type === 'tool-input-available' || part?.type === 'tool-output-available') return true;

                    // Generic tool part formats (e.g. "tool-<name>")
                    if (typeof part?.type === 'string' && part.type.startsWith('tool-')) return true;

                    // Dynamic tools
                    if (part?.type === 'dynamic-tool') return true;

                    return false;
                });
                return !hasContent;
            })() && <LoadingIndicator />}

            {/* Scroll anchor */}
            <div ref={messagesEndRef as React.RefObject<HTMLDivElement>} />

            {/* Image Preview Modal */}
            <ImagePreviewModal previewImage={previewImage} onClose={handleClosePreview} />
        </div>
    );
};
