/**
 * Shared Markdown Renderer Component
 * Reusable markdown rendering with consistent styling across overlays
 */
import { StreamdownRenderer } from '../../components/features/chat/components/display/StreamdownRenderer';

export interface MarkdownRendererProps {
    /** The markdown content to render */
    content: string;
    /** Whether content is currently streaming (shows cursor) */
    isStreaming?: boolean;
    /** Custom class name for the cursor (ignored by Streamdown) */
    cursorClassName?: string;
}

/**
 * Renders markdown content using Streamdown for consistent styling
 */
export function MarkdownRenderer({
    content,
    isStreaming = false,
    cursorClassName, // Ignored as Streamdown handles its own cursor
}: MarkdownRendererProps) {
    return (
        <StreamdownRenderer isAnimating={isStreaming}>
            {content || ''}
        </StreamdownRenderer>
    );
}

export default MarkdownRenderer;
