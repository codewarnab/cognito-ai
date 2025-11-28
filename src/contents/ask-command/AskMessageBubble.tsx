/**
 * Ask Message Bubble Component
 * Displays individual messages in the conversation
 */
import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type { AskMessage } from '@/types';
import { formatFileSize } from './askAttachmentUtils';

// Icons
const CopyIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
);

const CheckIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const PaperclipIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path
            d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

// Custom link component for markdown - opens in new tab
const MarkdownLink = ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href || '#'} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
    </a>
);

// Custom code component for markdown
const MarkdownCode = ({ inline, className, children, ...props }: any) => {
    if (inline) {
        return <code className="ask-inline-code" {...props}>{children}</code>;
    }
    return (
        <pre className="ask-code-block">
            <code className={className} {...props}>{children}</code>
        </pre>
    );
};

const markdownComponents = {
    a: MarkdownLink,
    code: MarkdownCode,
};

interface AskMessageBubbleProps {
    message: AskMessage;
    isStreaming?: boolean;
    streamingContent?: string;
}

export function AskMessageBubble({ message, isStreaming, streamingContent }: AskMessageBubbleProps) {
    const [copied, setCopied] = useState(false);
    const content = isStreaming ? streamingContent : message.content;
    const isUser = message.role === 'user';

    const handleCopy = useCallback(async () => {
        if (!content) return;
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Silently fail
        }
    }, [content]);

    return (
        <div className={`ask-message ${isUser ? 'ask-message--user' : 'ask-message--assistant'}`}>
            <div className="ask-message-header">
                <span className="ask-message-role">{isUser ? 'You' : 'AI'}</span>
                {!isUser && content && (
                    <button
                        type="button"
                        className="ask-message-copy"
                        onClick={handleCopy}
                        title="Copy this answer"
                        aria-label="Copy answer"
                    >
                        {copied ? <CheckIcon /> : <CopyIcon />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                )}
            </div>
            <div className="ask-message-content">
                {isUser ? (
                    content
                ) : (
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={markdownComponents}
                        skipHtml={true}
                    >
                        {content || ''}
                    </ReactMarkdown>
                )}
                {isStreaming && <span className="ask-cursor">▌</span>}
            </div>
            {message.attachment && (
                <div className="ask-message-attachment">
                    <PaperclipIcon />
                    <span className="ask-message-attachment-name">{message.attachment.fileName}</span>
                    <span className="ask-message-attachment-size">
                        ({formatFileSize(message.attachment.fileSize)})
                    </span>
                </div>
            )}
        </div>
    );
}
