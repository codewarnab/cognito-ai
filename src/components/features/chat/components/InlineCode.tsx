import React, { useState } from 'react';

interface InlineCodeProps {
    children: React.ReactNode;
    [key: string]: any;
}

// Custom inline code component with tooltip and copy functionality
export function InlineCode({ children, ...props }: InlineCodeProps) {
    const [copied, setCopied] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    // Check if the content is a URL
    const content = String(children).replace(/\n$/, '');
    const isUrl = /^https?:\/\//i.test(content);

    // Beautify URL display - show hostname and path instead of full URL
    const getDisplayText = () => {
        if (!isUrl) return children;

        try {
            const url = new URL(content);
            const hostname = url.hostname.replace(/^www\./, ''); // Remove www. prefix
            const path = url.pathname === '/' ? '' : url.pathname;
            return `${hostname}${path}`;
        } catch {
            // Fallback to original content if URL parsing fails
            return children;
        }
    };

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
                title={isUrl ? content : undefined}
                {...props}
            >
                {getDisplayText()}
            </code>
            {(showTooltip || copied) && (
                <span className={`inline-code-tooltip ${copied ? 'inline-code-tooltip-success' : ''}`}>
                    {copied ? '✓ Copied!' : isUrl ? 'Click to open' : 'Click to copy'}
                </span>
            )}
        </span>
    );
}
