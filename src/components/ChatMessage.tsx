import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import type { UIMessage } from 'ai';
import { ToolPartRenderer } from '../ai/ToolPartRenderer';

// Custom code block component with copy button
function CodeBlock({ node, inline, className, children, ...props }: any) {
    const [copied, setCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';

    const handleCopy = async () => {
        const code = String(children).replace(/\n$/, '');
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    if (inline) {
        return (
            <code className={className} {...props}>
                {children}
            </code>
        );
    }

    return (
        <div className="code-block-wrapper">
            <div className="code-block-header">
                {language && <span className="code-block-language">{language}</span>}
                <button
                    className="code-block-copy-btn"
                    onClick={handleCopy}
                    title="Copy code"
                >
                    {copied ? '✓ Copied' : '📋 Copy'}
                </button>
            </div>
            <pre>
                <code className={className} {...props}>
                    {children}
                </code>
            </pre>
        </div>
    );
}

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
        if (!message.parts || message.parts.length === 0) {
            return false;
        }

        return message.parts.some((part: any) =>
            part.type === 'tool-call' ||
            part.type === 'tool-result' ||
            part.type?.startsWith('tool-') ||
            part.type === 'dynamic-tool'
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

            {/* Render parts in their actual order - text and tools interleaved */}
            {message.parts && message.parts.length > 0 && (
                <div className="message-parts">
                    {message.parts.map((part: any, index: number) => {
                        // Render text parts
                        if (part.type === 'text' && part.text) {
                            return (
                                <div key={`text-${index}`} className={`message-content ${isError ? 'error' : ''}`}>
                                    {message.role === 'assistant' ? (
                                        <div className="markdown-content">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm, remarkBreaks]}
                                                rehypePlugins={[rehypeHighlight]}
                                                components={{
                                                    code: CodeBlock
                                                }}
                                            >
                                                {part.text}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        part.text
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
                                <div key={part.toolCallId || `tool-${index}`} className="message-tools">
                                    <ToolPartRenderer
                                        part={part}
                                        messageId={message.id}
                                    />
                                </div>
                            );
                        }

                        // Unknown part type
                        return null;
                    })}
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


