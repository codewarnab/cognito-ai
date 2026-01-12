/**
 * SafeMarkdown Component
 * 
 * Wrapper component for rendering markdown content with error handling.
 * Uses StreamdownRenderer for smooth streaming animation support and
 * wraps it in an error boundary to gracefully handle malformed markdown.
 */

import React from 'react';
import { StreamdownRenderer } from '../../StreamdownRenderer';
import { MarkdownErrorBoundary } from './MarkdownErrorBoundary';

interface SafeMarkdownProps {
    /** The markdown content to render */
    children: string;
    /** Whether the content is currently being streamed (enables animation) */
    isStreaming?: boolean;
}

/**
 * Safe markdown wrapper using Streamdown for better streaming support
 * 
 * Features:
 * - Smooth streaming animation when isStreaming=true
 * - Error boundary fallback to raw text if parsing fails
 * - Consistent styling through StreamdownRenderer
 * 
 * @example
 * ```tsx
 * // For streaming content
 * <SafeMarkdown isStreaming={true}>
 *   {partialMarkdown}
 * </SafeMarkdown>
 * 
 * // For static content
 * <SafeMarkdown>
 *   {completeMarkdown}
 * </SafeMarkdown>
 * ```
 */
export const SafeMarkdown: React.FC<SafeMarkdownProps> = ({
    children,
    isStreaming = false
}) => {
    return (
        <MarkdownErrorBoundary fallback={children}>
            <StreamdownRenderer isAnimating={isStreaming}>
                {children}
            </StreamdownRenderer>
        </MarkdownErrorBoundary>
    );
};
