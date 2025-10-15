import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type { ChatMessage as ChatMessageType } from '../db';

interface ChatMessageProps {
    message: ChatMessageType;
    onCopy?: (content: string) => void;
    onRegenerate?: () => void;
}

/**
 * Individual chat message component
 * Displays a single message with role-based styling
 */
export function ChatMessage({ message, onCopy, onRegenerate }: ChatMessageProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (onCopy) {
            onCopy(message.content);
        } else {
            try {
                await navigator.clipboard.writeText(message.content);
            } catch (err) {
                console.error('Failed to copy message:', err);
            }
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        if (isToday) {
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }

        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <div className={`chat-message ${message.role}`}>
            <div className="message-header">
                <span className="message-role">
                    {message.role === 'user' ? '👤 You' : '🤖 Assistant'}
                </span>
                <span className="message-time">{formatTime(message.timestamp)}</span>
            </div>

            <div className={`message-content ${message.metadata?.error ? 'error' : ''}`}>
                {message.role === 'assistant' ? (
                    <div className="markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                            {message.content}
                        </ReactMarkdown>
                    </div>
                ) : (
                    message.content
                )}
            </div>

            {message.role === 'assistant' && (
                <div className="message-actions">
                    <button
                        className="action-button"
                        onClick={handleCopy}
                        title="Copy message"
                        aria-label="Copy message to clipboard"
                    >
                        {copied ? '✓ Copied' : '📋 Copy'}
                    </button>

                    {onRegenerate && !message.metadata?.error && (
                        <button
                            className="action-button"
                            onClick={onRegenerate}
                            title="Regenerate response"
                            aria-label="Regenerate this response"
                        >
                            🔄 Regenerate
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

interface MessageListProps {
    messages: ChatMessageType[];
    isLoading?: boolean;
    onCopy?: (content: string) => void;
    onRegenerate?: (messageId: string) => void;
}

/**
 * Message list component
 * Displays all chat messages with auto-scroll
 */
export function MessageList({ messages, isLoading, onCopy, onRegenerate }: MessageListProps) {
    return (
        <div className="message-list">
            {messages.length === 0 && !isLoading && (
                <div className="empty-state">
                    <div className="empty-state-icon">💬</div>
                    <h2>Start a conversation</h2>
                    <p>Ask me anything about Chrome AI, web development, or general questions!</p>
                </div>
            )}

            {messages.map((message) => (
                <ChatMessage
                    key={message.id}
                    message={message}
                    onCopy={onCopy}
                    onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
                />
            ))}

            {isLoading && (
                <div className="chat-message assistant">
                    <div className="message-header">
                        <span className="message-role">🤖 Assistant</span>
                    </div>
                    <div className="message-content">
                        <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


