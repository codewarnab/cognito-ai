import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import { AnimatePresence, motion } from 'framer-motion';
import { renderTextWithMentions } from '../../../shared/inputs';
import { ToolPartRenderer } from '../../../../ai/tools/components';
import type { Message } from '../types';
import { getMessageContent, hasToolCalls } from '../utils';
import { EmptyState } from './EmptyState';
import { LoadingIndicator } from './LoadingIndicator';
import { ContinueButton } from './ContinueButton';

// Custom inline code component with tooltip and copy functionality
function InlineCode({ children, ...props }: any) {
    const [copied, setCopied] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    // Check if the content is a URL
    const content = String(children).replace(/\n$/, '');
    const isUrl = /^https?:\/\//i.test(content);

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isUrl) {
            // Open URL in new tab
            window.open(content, '_blank', 'noopener,noreferrer');
        } else {
            // Copy non-URL content
            try {
                await navigator.clipboard.writeText(content);
                setCopied(true);
                setTimeout(() => {
                    setCopied(false);
                }, 2000);
            } catch (err) {
                console.error('Failed to copy code:', err);
            }
        }
    };

    return (
        <span
            className="inline-code-wrapper"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <code
                className={`inline-code-clickable ${isUrl ? 'inline-code-link' : ''}`}
                onClick={handleClick}
                {...props}
            >
                {children}
            </code>
            {(showTooltip || copied) && (
                <span className={`inline-code-tooltip ${copied ? 'inline-code-tooltip-success' : ''}`}>
                    {copied ? '✓ Copied!' : isUrl ? 'Click to open' : 'Click to copy'}
                </span>
            )}
        </span>
    );
}

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

    // Render inline code without wrapper - check both inline prop and node data
    const isInline = inline || node?.properties?.inline || !className?.includes('language-');

    if (isInline) {
        return <InlineCode {...props}>{children}</InlineCode>;
    }

    // Render block code with wrapper and copy button
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

// Custom components to handle streaming markdown gracefully
const markdownComponents = {
    a: ({ node, href, children, ...props }: any) => {
        // Handle cases where href might be undefined during streaming
        const safeHref = href || '#';
        return (
            <a href={safeHref} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
            </a>
        );
    },
    code: CodeBlock,
    // Add other custom components as needed
};

// Error Boundary for Markdown rendering
class MarkdownErrorBoundary extends React.Component<
    { children: React.ReactNode; fallback: string },
    { hasError: boolean }
> {
    constructor(props: { children: React.ReactNode; fallback: string }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.warn('Markdown rendering error (likely due to streaming):', error);
    }

    render() {
        if (this.state.hasError) {
            return <div className="markdown-fallback">{this.props.fallback}</div>;
        }
        return this.props.children;
    }
}

// Safe markdown wrapper to handle parsing errors during streaming
const SafeMarkdown: React.FC<{ children: string }> = ({ children }) => {
    return (
        <MarkdownErrorBoundary fallback={children}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                rehypePlugins={[rehypeHighlight]}
                components={markdownComponents}
                skipHtml={true}
            >
                {children}
            </ReactMarkdown>
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
    isLocalMode,
    onConfigureApiKey,
    onContinue,
}) => {
    // Check if the last message has continue-available status
    const showContinueButton = useMemo(() => {
        if (isLoading || messages.length === 0) return false;

        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role !== 'assistant') return false;

        // Check if any part has continue-available status
        const hasContinueStatus = lastMessage.parts?.some((part: any) =>
            part.type === 'data-status' &&
            part.data?.status === 'continue-available'
        );

        return hasContinueStatus;
    }, [messages, isLoading]);

    return (
        <div className="copilot-messages">{messages.length === 0 ? (
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
                                                                        <SafeMarkdown>
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

                                                    // Skip rendering data-status parts (they're metadata)
                                                    if (part.type === 'data-status') {
                                                        return null;
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

            {/* Continue Button - shown when AI hits step count limit */}
            {showContinueButton && onContinue && (
                <ContinueButton onContinue={onContinue} isLoading={isLoading} />
            )}

            {/* Loading Indicator */}
            {isLoading && <LoadingIndicator />}

            <div ref={messagesEndRef} />
        </div>
    );
};
