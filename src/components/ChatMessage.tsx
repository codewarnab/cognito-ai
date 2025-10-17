import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type { UIMessage } from 'ai';
import { ToolPartRenderer } from './ToolPartRenderer';

interface ChatMessageProps {
    message: UIMessage;
    onCopy?: (content: string) => void;
    onRegenerate?: () => void;
}

/**
 * Individual chat message component
 * Displays a single message with role-based styling
 * Updated to use AI SDK v5 UIMessage type
 */
export function ChatMessage({ message, onCopy, onRegenerate }: ChatMessageProps) {
    const [copied, setCopied] = useState(false);

    // Extract text content from parts array
    const getTextContent = (message: UIMessage): string => {
        if (!message.parts || message.parts.length === 0) return '';
        
        return message.parts
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text)
            .join('');
    };

    // Check if message has tool calls
    const hasToolCalls = (message: UIMessage): boolean => {
        if (!message.parts || message.parts.length === 0) return false;
        
        return message.parts.some((part: any) => 
            part.type?.startsWith('tool-') || part.type === 'dynamic-tool'
        );
    };

    const handleCopy = async () => {
        const content = getTextContent(message);
        if (onCopy) {
            onCopy(content);
        } else {
            try {
                await navigator.clipboard.writeText(content);
            } catch (err) {
                console.error('Failed to copy message:', err);
            }
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatTime = (createdAt?: Date) => {
        if (!createdAt) return '';
        
        const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
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

    const content = getTextContent(message);
    const isError = (message as any).metadata?.error;
    const hasTools = hasToolCalls(message);

    return (
        <div className={`chat-message ${message.role}`}>
            <div className="message-header">
                <span className="message-role">
                    {message.role === 'user' ? '👤 You' : '🤖 Assistant'}
                </span>
                <span className="message-time">{formatTime((message as any).createdAt)}</span>
            </div>

            {/* Render text content */}
            {content && (
                <div className={`message-content ${isError ? 'error' : ''}`}>
                    {message.role === 'assistant' ? (
                        <div className="markdown-content">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                {content}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        content
                    )}
                </div>
            )}

            {/* Render tool calls */}
            {hasTools && message.parts && (
                <div className="message-tools">
                    {message.parts
                        .filter((part: any) => part.type?.startsWith('tool-') || part.type === 'dynamic-tool')
                        .map((part: any, index: number) => (
                            <ToolPartRenderer
                                key={part.toolCallId || `${message.id}-tool-${index}`}
                                part={part}
                                messageId={message.id}
                            />
                        ))
                    }
                </div>
            )}

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

                    {onRegenerate && !isError && (
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
    messages: UIMessage[];
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


