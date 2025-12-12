/**
 * Lightweight Markdown Renderer for Content Scripts
 * 
 * Uses react-markdown instead of streamdown/shiki to avoid the massive
 * bundle size (35MB+ per content script from Shiki's language grammars).
 * 
 * For the sidepanel/main chat, use StreamdownRenderer which has full
 * syntax highlighting support.
 */
import type { Components } from 'react-markdown';
import Markdown from 'react-markdown';

export interface LightMarkdownRendererProps {
    /** The markdown content to render */
    content: string;
    /** Whether content is currently streaming (shows cursor) */
    isStreaming?: boolean;
    /** Custom class name for styling */
    className?: string;
}

/**
 * Custom components for react-markdown with Tailwind styling
 */
const components: Components = {
    h1: ({ children }) => (
        <h1 className="text-2xl font-bold my-3">{children}</h1>
    ),
    h2: ({ children }) => (
        <h2 className="text-xl font-bold my-2.5">{children}</h2>
    ),
    h3: ({ children }) => (
        <h3 className="text-lg font-semibold my-2">{children}</h3>
    ),
    h4: ({ children }) => (
        <h4 className="text-base font-semibold my-2">{children}</h4>
    ),
    h5: ({ children }) => (
        <h5 className="text-sm font-semibold my-1.5">{children}</h5>
    ),
    h6: ({ children }) => (
        <h6 className="text-sm font-medium my-1.5">{children}</h6>
    ),
    p: ({ children }) => (
        <p className="my-1.5 leading-relaxed">{children}</p>
    ),
    ul: ({ children }) => (
        <ul className="list-disc pl-6 my-2">{children}</ul>
    ),
    ol: ({ children }) => (
        <ol className="list-decimal pl-6 my-2">{children}</ol>
    ),
    li: ({ children }) => (
        <li className="my-0.5">{children}</li>
    ),
    blockquote: ({ children }) => (
        <blockquote className="border-l-4 border-primary/30 pl-4 my-2 italic text-muted-foreground">
            {children}
        </blockquote>
    ),
    code: ({ className, children, ...props }) => {
        // Check if this is a code block (has language class) or inline code
        const isBlock = className?.includes('language-');
        if (isBlock) {
            return (
                <code className="text-sm font-mono whitespace-pre" {...props}>
                    {children}
                </code>
            );
        }
        return (
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
            </code>
        );
    },
    pre: ({ children }) => (
        <pre className="bg-muted rounded-lg p-4 my-2 overflow-x-auto">
            {children}
        </pre>
    ),
    a: ({ href, children }) => (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
        >
            {children}
        </a>
    ),
    hr: () => <hr className="my-4 border-border" />,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
};

/**
 * Lightweight markdown renderer optimized for content scripts
 * Uses react-markdown - much smaller than streamdown/shiki
 */
export function LightMarkdownRenderer({
    content,
    isStreaming = false,
    className = '',
}: LightMarkdownRendererProps) {
    return (
        <div className={`light-markdown-content text-sm ${className}`}>
            <Markdown components={components}>{content}</Markdown>
            {isStreaming && (
                <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
            )}
        </div>
    );
}

export default LightMarkdownRenderer;
