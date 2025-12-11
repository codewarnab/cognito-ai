/**
 * Shared Markdown Renderer Component
 * Reusable markdown rendering with consistent styling across overlays
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

// Custom link component - opens in new tab
const MarkdownLink = ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href || '#'} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
    </a>
);

// Custom code component for inline and block code
const MarkdownCode = ({ inline, className, children, ...props }: {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
}) => {
    if (inline) {
        return (
            <code className="markdown-inline-code" {...props}>
                {children}
            </code>
        );
    }
    return (
        <pre className="markdown-code-block">
            <code className={className} {...props}>
                {children}
            </code>
        </pre>
    );
};

const markdownComponents = {
    a: MarkdownLink,
    code: MarkdownCode,
};

export interface MarkdownRendererProps {
    /** The markdown content to render */
    content: string;
    /** Whether content is currently streaming (shows cursor) */
    isStreaming?: boolean;
    /** Custom class name for the cursor */
    cursorClassName?: string;
}

/**
 * Renders markdown content with GFM support and optional streaming cursor
 */
export function MarkdownRenderer({
    content,
    isStreaming = false,
    cursorClassName = 'markdown-cursor',
}: MarkdownRendererProps) {
    return (
        <>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={markdownComponents}
                skipHtml={true}
            >
                {content || ''}
            </ReactMarkdown>
            {isStreaming && <span className={cursorClassName}>▌</span>}
        </>
    );
}

export default MarkdownRenderer;
