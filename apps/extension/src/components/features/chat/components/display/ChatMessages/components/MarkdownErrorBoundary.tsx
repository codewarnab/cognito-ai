/**
 * MarkdownErrorBoundary
 * 
 * Error boundary component that catches rendering errors in markdown content.
 * If markdown parsing/rendering fails, displays the raw text as fallback.
 * 
 * This is a safety net to ensure chat messages are always visible,
 * even if the markdown contains malformed or edge-case content.
 */

import React from 'react';

interface MarkdownErrorBoundaryProps {
    children: React.ReactNode;
    /** Fallback text to display if markdown rendering fails */
    fallback: string;
}

interface MarkdownErrorBoundaryState {
    hasError: boolean;
}

/**
 * Error boundary that wraps markdown rendering
 * 
 * @example
 * ```tsx
 * <MarkdownErrorBoundary fallback={rawText}>
 *   <MarkdownRenderer>{rawText}</MarkdownRenderer>
 * </MarkdownErrorBoundary>
 * ```
 */
export class MarkdownErrorBoundary extends React.Component<
    MarkdownErrorBoundaryProps,
    MarkdownErrorBoundaryState
> {
    constructor(props: MarkdownErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    /**
     * Update state when an error is caught
     * Called during the "render" phase
     */
    static getDerivedStateFromError(): MarkdownErrorBoundaryState {
        return { hasError: true };
    }

    /**
     * Log error details for debugging
     * Called during the "commit" phase
     */
    override componentDidCatch(error: Error): void {
        // Log minimal info to avoid console spam
        console.warn('Markdown rendering error:', error.message);
    }

    override render(): React.ReactNode {
        if (this.state.hasError) {
            // Render fallback UI - just the raw text in a styled div
            return (
                <div className="markdown-fallback whitespace-pre-wrap">
                    {this.props.fallback}
                </div>
            );
        }

        return this.props.children;
    }
}
