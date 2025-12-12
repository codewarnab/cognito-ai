/**
 * Shared Markdown Renderer Component
 * Reusable markdown rendering with consistent styling across overlays
 * 
 * Uses LightMarkdownRenderer for content scripts to avoid bundling
 * streamdown/shiki (~35MB) in each content script separately.
 */
import { LightMarkdownRenderer } from './LightMarkdownRenderer';

export interface MarkdownRendererProps {
    /** The markdown content to render */
    content: string;
    /** Whether content is currently streaming (shows cursor) */
    isStreaming?: boolean;
    /** Custom class name for styling */
    className?: string;
    /** @deprecated Use className instead */
    cursorClassName?: string;
}

/**
 * Renders markdown content using a lightweight parser
 * Optimized for content scripts - no syntax highlighting
 * 
 * For full syntax highlighting, use StreamdownRenderer directly in sidepanel
 */
export function MarkdownRenderer({
    content,
    isStreaming = false,
    className,
    cursorClassName, // Deprecated
}: MarkdownRendererProps) {
    return (
        <LightMarkdownRenderer
            content={content || ''}
            isStreaming={isStreaming}
            className={className || cursorClassName}
        />
    );
}

export default MarkdownRenderer;
