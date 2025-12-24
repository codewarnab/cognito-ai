import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import '@/styles/components/chat-scrollbar.css';
import { AnimatePresence, motion } from 'framer-motion';
import { renderTextWithMentions } from '@/components/shared/inputs';
import { ToolPartRenderer } from '@/ai/tools/components';
import { CollapsibleUserMessage } from './CollapsibleUserMessage';
import type { Message } from '../../types';
import { getMessageContent, hasToolCalls, hasAttachments } from '../../utils';
import { EmptyState } from '../states/EmptyState';
import { LoadingIndicator } from '../feedback/LoadingIndicator';
import { ContinueButton } from '../buttons/ContinueButton';
import { CopyButton } from '../buttons/CopyButton';
import { UserMessageCopyButton } from '../buttons/UserMessageCopyButton';
import { getFileIcon, truncateFileName } from '@/utils/files';
import { StreamdownRenderer } from './StreamdownRenderer';
import { AudioMessagePlayer } from './AudioMessagePlayer';
import { XIcon } from '@assets/icons/chat/x';
import { ExternalLink } from 'lucide-react';
import { useInlineCodeEnhancer } from '@/hooks/useInlineCodeEnhancer';
import { useMessageTextSelection } from '@/hooks/chat';
import { QuotePopover } from './QuotePopover';

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
    onQuoteText?: (text: string) => void; // Callback to insert quoted text into composer
    addToolOutput?: (params: { tool: string; toolCallId: string; output: any }) => void; // Human-in-the-loop approval
}

/**
 * Merge tool-call and tool-result parts by toolCallId
 * This prevents showing both loading and success icons for the same tool execution
 * 
 * For MCP tools with longer wait times, this ensures:
 * - tool-call shows loading state (no result yet)
 * - tool-result shows success state (execution complete)
 * - Only the latest state is displayed
 * 
 * Handles both AI SDK format (tool-call/tool-result) and Gemini format (functionCall/functionResponse)
 */
function mergeToolParts(parts: any[]): any[] {
    const toolMap = new Map<string, any>();
    const mergedParts: any[] = [];

    // Helper to check if part is a tool call (AI SDK or Gemini format)
    const isToolCall = (part: any) =>
        part.type === 'tool-call' ||
        part.type?.startsWith('tool-') ||
        part.type === 'dynamic-tool' ||
        part.functionCall !== undefined;

    // Helper to check if part is a tool result (AI SDK or Gemini format)
    const isToolResult = (part: any) =>
        part.type === 'tool-result' ||
        part.type === 'tool-output-available' ||
        part.functionResponse !== undefined;

    // Helper to get toolCallId from various formats
    const getToolCallId = (part: any): string | undefined => {
        if (part.toolCallId) return part.toolCallId;
        if (part.functionCall?.name) return `gemini-${part.functionCall.name}`;
        if (part.functionResponse?.name) return `gemini-${part.functionResponse.name}`;
        return undefined;
    };

    for (const part of parts) {
        // Handle text parts - always include
        if (part.type === 'text') {
            mergedParts.push(part);
            continue;
        }

        // Handle tool parts - merge by toolCallId
        if (isToolCall(part) || isToolResult(part)) {
            const toolCallId = getToolCallId(part);

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
                // tool-result/functionResponse should override tool-call/functionCall
                if (isToolResult(part)) {
                    // Replace the existing part with the result
                    const index = mergedParts.indexOf(existingTool);
                    if (index !== -1) {
                        // Merge input from tool-call with output from tool-result
                        const mergedPart = {
                            ...part,
                            args: existingTool.args || part.args,
                            input: existingTool.input || part.input || existingTool.functionCall?.args,
                        };
                        mergedParts[index] = mergedPart;
                        toolMap.set(toolCallId, mergedPart);
                    }
                } else if (isToolCall(existingTool) && isToolCall(part)) {
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
    onQuoteText,
    addToolOutput,
}) => {
    const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

    // Ref for the messages container - used for inline code enhancement
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Enhance inline code elements with click-to-copy and URL opening
    useInlineCodeEnhancer(messagesContainerRef, isLoading);

    // Text selection for quoting messages
    const textSelection = useMessageTextSelection(messagesContainerRef);

    // Handle quote action - format selected text as blockquote
    const handleQuote = useCallback((text: string) => {
        if (!onQuoteText) return;
        // Format as markdown blockquote (prefix each line with > )
        const quotedText = text
            .split('\n')
            .map(line => `> ${line}`)
            .join('\n');
        onQuoteText(quotedText + '\n\n');
    }, [onQuoteText]);

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

    // ESC key handler for image preview
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && previewImage) {
                setPreviewImage(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
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

    // Pre-process messages to:
    // 1. Deduplicate consecutive assistant messages with the same toolCallId (AI SDK v6 bug workaround)
    //    The bug: AbstractChat.makeRequest generates a new message ID at line 9363, ignoring the
    //    messageId parameter passed from addToolOutput. This causes pushMessage instead of replaceMessage.
    // NOTE: We no longer merge user tool-result messages - that was causing issues with subsequent tool calls
    const processedMessages = useMemo(() => {
        const result: Message[] = [];
        const skipIds = new Set<string>();

        // Helper to extract tool identifiers from a message (supports both AI SDK and Gemini formats)
        const getToolIdentifiers = (m: Message): Set<string> => {
            const ids = new Set<string>();
            if (!m.parts) return ids;
            m.parts.forEach((part: any) => {
                // AI SDK format: uses toolCallId
                if (part.toolCallId) {
                    ids.add(part.toolCallId);
                }
                // Gemini format: uses functionCall.name (fallback)
                // Note: We create a composite key to avoid collisions
                if (part.functionCall?.name && !part.toolCallId) {
                    // Use function name + args hash as identifier
                    const argsStr = JSON.stringify(part.functionCall.args || {});
                    ids.add(`gemini:${part.functionCall.name}:${argsStr.substring(0, 50)}`);
                }
            });
            return ids;
        };

        // Helper to check if two messages are duplicates (same tool calls)
        // Returns true ONLY if they have exactly the same tools (not just overlapping)
        const areDuplicateToolMessages = (m1: Message, m2: Message): boolean => {
            const ids1 = getToolIdentifiers(m1);
            const ids2 = getToolIdentifiers(m2);

            // Must have same number of tool calls
            if (ids1.size !== ids2.size || ids1.size === 0) return false;

            // All IDs must match
            for (const id of ids1) {
                if (!ids2.has(id)) return false;
            }
            return true;
        };

        // Helper to check if a tool part has output (completed state)
        const hasToolOutput = (part: any): boolean => {
            return part.state === 'output-available' ||
                part.state === 'result' ||
                part.output !== undefined ||
                part.functionResponse !== undefined;
        };

        // Helper to merge two assistant messages with matching tool calls
        // The newer message's parts take precedence for completed tool calls
        const mergeAssistantMessages = (older: Message, newer: Message): Message => {
            const olderParts = older.parts || [];
            const newerParts = newer.parts || [];

            // Create a map of toolCallId -> newer part (with output)
            const newerToolParts = new Map<string, any>();
            newerParts.forEach((part: any) => {
                if (part.toolCallId && hasToolOutput(part)) {
                    newerToolParts.set(part.toolCallId, part);
                }
            });

            // Merge: use newer parts where available, otherwise keep older parts
            const mergedParts = olderParts.map((part: any) => {
                if (part.toolCallId && newerToolParts.has(part.toolCallId)) {
                    return newerToolParts.get(part.toolCallId);
                }
                return part;
            });

            // Add any text parts from newer message that aren't in older
            newerParts.forEach((part: any) => {
                if (part.type === 'text' && part.text?.trim()) {
                    // Only add if older doesn't have this text
                    const hasText = mergedParts.some((p: any) =>
                        p.type === 'text' && p.text === part.text
                    );
                    if (!hasText) {
                        mergedParts.push(part);
                    }
                }
            });

            return {
                ...older,
                parts: mergedParts
            };
        };

        console.log('[DEDUP] Processing messages, count:', messages.length);

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];

            if (!msg) continue;
            if (msg.id && skipIds.has(msg.id)) {
                console.log(`[DEDUP] Skipping message ${i} (id: ${msg.id}) - already processed`);
                continue;
            }

            const hasToolCallsResult = hasToolCalls(msg);
            console.log(`[DEDUP] Message ${i}: role=${msg.role}, hasTools=${hasToolCallsResult}, id=${msg.id}`);

            // Only deduplicate assistant messages with tool calls
            if (msg.role === 'assistant' && hasToolCallsResult) {
                // Look ahead for potential duplicates (AI SDK v6 bug creates duplicate assistant messages)
                if (i + 1 < messages.length) {
                    const nextMsg = messages[i + 1];

                    // ONLY merge if next is ALSO an assistant message with EXACTLY the same tools
                    // This handles the duplicate bug where the same tool call appears twice
                    if (nextMsg && nextMsg.role === 'assistant' && hasToolCalls(nextMsg)) {
                        if (areDuplicateToolMessages(msg, nextMsg)) {
                            console.log('[DEDUP] ✓ Found exact duplicate, merging', {
                                olderId: msg.id,
                                newerId: nextMsg.id,
                                toolIds: Array.from(getToolIdentifiers(msg))
                            });

                            // Merge the messages, newer takes precedence for completed tools
                            const mergedMsg = mergeAssistantMessages(msg, nextMsg);
                            result.push(mergedMsg);

                            // Skip the duplicate
                            if (nextMsg.id) {
                                skipIds.add(nextMsg.id);
                            }
                            continue;
                        } else {
                            console.log('[DEDUP] ✗ Not duplicates - different tools', {
                                msg1Tools: Array.from(getToolIdentifiers(msg)),
                                msg2Tools: Array.from(getToolIdentifiers(nextMsg))
                            });
                        }
                    }
                }
            }

            // Default: just push the message
            result.push(msg);
        }

        console.log('[DEDUP] Final result count:', result.length, 'skipped:', Array.from(skipIds));
        return result;
    }, [messages]);

    return (
        <div className="chat-messages-container flex-1 overflow-y-auto overflow-x-hidden pr-1 pl-4 pb-6 pt-16 flex flex-col gap-3 bg-[#0a0e1a] min-h-0 relative" ref={messagesContainerRef}>
            {/* Quote popover for text selection */}
            <QuotePopover selection={textSelection} onQuote={handleQuote} />

            {messages.length === 0 ? (
                <EmptyState isLocalMode={isLocalMode} onConfigureApiKey={onConfigureApiKey} />
            ) : (
                <AnimatePresence>
                    {processedMessages
                        .filter(message => {
                            // Filter out internal messages (tab context)
                            if ((message as any).metadata?.internal) {
                                return false;
                            }

                            // Note: We don't need to filter tool-result messages here anymore
                            // because they are handled in processedMessages above

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
                                    className={`flex gap-3 max-w-full group ${message.role === 'user' ? 'justify-end items-start gap-3 ml-auto pr-1' : 'justify-start items-start pr-2'}`}
                                >
                                    <div className={`rounded-xl px-3 py-2 max-w-[90%] text-sm leading-relaxed break-words ${message.role === 'user'
                                        ? 'bg-blue-500 text-white ml-auto shadow-[0_2px_8px_var(--message-user-shadow)] rounded-br-none'
                                        : hasToolCalls(message)
                                            ? 'bg-transparent !p-0'
                                            : 'bg-transparent !text-[var(--text-primary)] !border-none !shadow-none !p-0 !rounded-none !max-w-full !text-sm'
                                        }`}>
                                        {/* Render parts in their actual order - text and tools interleaved */}
                                        {message.parts && message.parts.length > 0 && (() => {
                                            // Merge tool-call and tool-result parts to avoid duplicate rendering
                                            const mergedParts = mergeToolParts(message.parts);

                                            return (
                                                <div className="flex flex-col gap-2">
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

                                                            {/* User message - CollapsibleUserMessage handles its own wrapper */ }
                                                            return (
                                                                <CollapsibleUserMessage
                                                                    key={`text-${partIndex}`}
                                                                    text={part.text}
                                                                    renderContent={(text) => renderTextWithMentions(text)}
                                                                />
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
                                                            const isAudio = firstFile.mediaType?.startsWith('audio/');

                                                            return (
                                                                <div key={`file-group-${partIndex}`} className="relative inline-block my-2">
                                                                    <div className="inline-block">
                                                                        {isImage ? (
                                                                            <div
                                                                                className="relative w-[75px] h-[75px] rounded-[10px] overflow-hidden bg-[rgba(30,40,60,0.6)] border-[1.5px] border-[rgba(100,120,150,0.3)] p-[3px] shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-all duration-200 cursor-pointer hover:scale-105 hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                                                                                onClick={() => setPreviewImage({ url: firstFile.url, name: firstFile.name || 'Image' })}
                                                                            >
                                                                                <img src={firstFile.url} alt={firstFile.name || 'Attached image'} className="w-full h-full object-cover block rounded-md cursor-pointer" />
                                                                            </div>
                                                                        ) : isAudio ? (
                                                                            <AudioMessagePlayer url={firstFile.url} name={firstFile.name} />
                                                                        ) : (
                                                                            <div
                                                                                className="relative group/file inline-flex items-center gap-2.5 px-3.5 py-2.5 min-w-[130px] max-w-[220px] bg-[rgba(35,45,65,0.7)] rounded-[10px] border-[1.5px] border-[rgba(100,120,150,0.3)] shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-all duration-200 hover:bg-[rgba(45,55,75,0.8)] hover:border-[rgba(120,140,170,0.5)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:-translate-y-px"
                                                                            >
                                                                                <div className="text-[22px] flex-shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
                                                                                    {getFileIcon(firstFile.name || 'file', 24)}
                                                                                </div>
                                                                                <span className="text-[13px] text-white/90 whitespace-nowrap overflow-hidden text-ellipsis flex-1 font-medium" title={firstFile.name}>
                                                                                    {truncateFileName(firstFile.name)}
                                                                                </span>
                                                                                {totalFiles === 1 && (firstFile.mediaType === 'application/pdf' || firstFile.name?.toLowerCase().endsWith('.pdf')) && (
                                                                                    <div
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                                                                                                chrome.tabs.create({ url: firstFile.url, active: true });
                                                                                            } else {
                                                                                                window.open(firstFile.url, '_blank', 'noopener,noreferrer');
                                                                                            }
                                                                                        }}
                                                                                        className="hidden group-hover/file:flex items-center justify-center text-white/60 hover:text-white/95 transition-colors absolute right-2 bg-[rgba(45,55,75,0.9)] rounded-md p-1 shadow-sm cursor-pointer"
                                                                                        title="Open PDF in new tab"
                                                                                    >
                                                                                        <ExternalLink size={14} />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {remainingCount > 0 && (
                                                                        <div className="absolute -top-1.5 -right-1.5 bg-blue-500/95 text-white text-[11px] font-bold px-2 py-1 rounded-xl border-2 border-[rgba(30,40,60,0.9)] shadow-[0_2px_8px_rgba(0,0,0,0.4)] z-[2] min-w-[24px] text-center">
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
                                                                <div key={`tab-group-${partIndex}`} className="relative inline-block my-2">
                                                                    <div className="flex items-center gap-3 px-3.5 py-3 bg-blue-500/8 border border-blue-500/25 rounded-lg transition-all duration-200 relative z-[1] hover:bg-blue-500/12 hover:border-blue-500/40">
                                                                        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                                                                            {firstTab.favicon ? (
                                                                                <img
                                                                                    src={firstTab.favicon}
                                                                                    alt=""
                                                                                    className="w-5 h-5 rounded object-contain"
                                                                                />
                                                                            ) : (
                                                                                <div className="w-5 h-5 flex items-center justify-center text-base opacity-70">🌐</div>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                                                                            <div className="text-[13px] font-semibold text-white/95 whitespace-nowrap overflow-hidden text-ellipsis" title={firstTab.title}>
                                                                                {firstTab.title}
                                                                            </div>
                                                                            <div className="text-[11px] text-white/60 whitespace-nowrap overflow-hidden text-ellipsis" title={firstTab.url}>
                                                                                {firstTab.url}
                                                                            </div>
                                                                            {firstTab.error && (
                                                                                <div className="text-[11px] text-[rgba(255,150,50,0.9)] font-medium mt-0.5">
                                                                                    ⚠️ {firstTab.error}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {remainingCount > 0 && (
                                                                        <div className="absolute -top-1.5 -right-1.5 bg-blue-500/95 text-white text-[11px] font-bold px-2 py-1 rounded-xl border-2 border-[rgba(30,40,60,0.9)] shadow-[0_2px_8px_rgba(0,0,0,0.4)] z-[2] min-w-[24px] text-center">
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
                                                                <div key={part.toolCallId || `tool-${partIndex}`} className="mt-1 flex flex-col gap-1">
                                                                    <ToolPartRenderer
                                                                        part={part}
                                                                        messageId={message.id || `msg-${index}`}
                                                                        addToolOutput={addToolOutput}
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
                                    {/* Copy button for user messages - positioned to the left of bubble via CSS order */}
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
                        className="fixed inset-0 bg-black/90 z-[10000] flex items-center justify-center p-10 cursor-pointer"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setPreviewImage(null)}
                    >
                        <button
                            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-gray-500/50 border-none flex items-center justify-center cursor-pointer z-[9999] transition-colors duration-200 text-white hover:bg-gray-500/70 active:bg-gray-500/80"
                            onClick={() => setPreviewImage(null)}
                            aria-label="Close preview"
                        >
                            <XIcon size={20} />
                        </button>
                        <motion.div
                            className="max-w-[90vw] max-h-[90vh] flex flex-col items-center justify-center cursor-default gap-3"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img src={previewImage.url} alt={previewImage.name} className="max-w-full max-h-[calc(90vh-40px)] w-auto h-auto rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] object-contain" />
                            <div className="text-[13px] text-white/50 text-center px-3 py-1 bg-white/8 rounded-md">Press ESC to close</div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
