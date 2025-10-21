import React from 'react';
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
                                        {message.parts && message.parts.length > 0 && (
                                            <div className="message-parts">
                                                {message.parts.map((part: any, partIndex: number) => {
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
                                        )}
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
