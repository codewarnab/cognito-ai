import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { AnimatePresence, motion } from 'framer-motion';
import { renderTextWithMentions } from '../MentionBadge';
import { ToolPartRenderer } from '../../ai/ToolPartRenderer';
import type { Message } from './types';
import { getMessageContent, hasToolCalls } from './utils';
import { EmptyState } from './EmptyState';
import { LoadingIndicator } from './LoadingIndicator';

interface ChatMessagesProps {
    messages: Message[];
    isLoading: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    pendingMessageId?: string | null;
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

export const ChatMessages: React.FC<ChatMessagesProps> = ({
    messages,
    isLoading,
    messagesEndRef,
    pendingMessageId,
}) => {
    return (
        <div className="copilot-messages">
            {messages.length === 0 ? (
                <EmptyState />
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

                            // Show message if it has text OR tool calls
                            return hasText || hasTools;
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
                                    {message.role === 'assistant' && (
                                        <div className="copilot-message-avatar">🤖</div>
                                    )}

                                    <div className={`copilot-message-bubble copilot-message-bubble-${message.role} ${hasToolCalls(message) ? 'copilot-message-bubble-no-bg' : ''}`}>
                                        {/* Render parts in their actual order - text and tools interleaved */}
                                        {message.parts && message.parts.length > 0 && (() => {
                                            // Merge tool-call and tool-result parts to avoid duplicate rendering
                                            const mergedParts = mergeToolParts(message.parts);

                                            return (
                                                <div className="message-parts">
                                                    {mergedParts.map((part: any, partIndex: number) => {
                                                        // Render text parts
                                                        if (part.type === 'text' && part.text) {
                                                            return (
                                                                <div key={`text-${partIndex}`} className="copilot-message-content">
                                                                    {message.role === 'assistant' ? (
                                                                        <div className="markdown-content">
                                                                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                                                                {part.text}
                                                                            </ReactMarkdown>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="user-message-with-mentions">
                                                                            {renderTextWithMentions(part.text)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        }

                                                        // Render file attachments
                                                        if (part.type === 'file') {
                                                            const isImage = part.mediaType?.startsWith('image/');
                                                            const isPdf = part.mediaType === 'application/pdf';

                                                            return (
                                                                <div key={`file-${partIndex}`} className="message-file-attachment">
                                                                    {isImage ? (
                                                                        <div className="message-file-image">
                                                                            <img src={part.url} alt={part.name || 'Attached image'} />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="message-file-document">
                                                                            <div className="file-attachment-icon">
                                                                                {isPdf ? '📕' : '📄'}
                                                                            </div>
                                                                            <span className="file-attachment-name" title={part.name}>
                                                                                {part.name || 'Document'}
                                                                            </span>
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

                                                        // Unknown part type
                                                        return null;
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {message.role === 'user' && (
                                        <div className="copilot-message-avatar">👤</div>
                                    )}
                                </motion.div>
                            );
                        })}
                </AnimatePresence>
            )}

            {/* Loading Indicator */}
            {isLoading && <LoadingIndicator />}

            <div ref={messagesEndRef} />
        </div>
    );
};
