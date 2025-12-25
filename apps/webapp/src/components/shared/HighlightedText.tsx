import React from 'react';

/**
 * Escapes special characters in a string for use in HTML
 */
const escapeHtml = (input: string): string => {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

/**
 * Escapes special characters in a string for use in RegExp
 */
const escapeRegExp = (input: string): string => {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Builds HTML string with highlighted search matches
 * @param text - The text to highlight
 * @param searchQuery - The search query to highlight
 * @returns HTML string with <mark> tags around matches
 */
export const buildHighlightHtml = (text: string, searchQuery: string): string => {
    const query = searchQuery.trim();
    if (!query) return escapeHtml(text);

    const safeText = escapeHtml(text);
    const pattern = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    return safeText.replace(
        pattern,
        '<mark class="bg-[var(--blue-stride)]/30 text-inherit rounded-sm">$1</mark>'
    );
};

interface HighlightedTextProps {
    text: string;
    searchQuery?: string;
    className?: string;
    style?: React.CSSProperties;
    title?: string;
}

/**
 * React component that renders text with highlighted search matches
 */
export const HighlightedText: React.FC<HighlightedTextProps> = ({
    text,
    searchQuery,
    className,
    style,
    title
}) => {
    if (!searchQuery || !searchQuery.trim()) {
        return (
            <span className={className} style={style} title={title}>
                {text}
            </span>
        );
    }

    return (
        <span
            className={className}
            style={style}
            title={title}
            dangerouslySetInnerHTML={{
                __html: buildHighlightHtml(text, searchQuery)
            }}
        />
    );
};
