import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface InlineCodeProps {
    children: React.ReactNode;
    [key: string]: unknown;
}

/**
 * Custom inline code component with tooltip and copy/link functionality
 * 
 * Features:
 * - Auto-detects URLs (http:// or https://)
 * - URLs: Click to open in new tab, shows shortened display
 * - Non-URLs: Click to copy to clipboard
 * - Animated tooltip feedback on hover
 */
export function InlineCode({ children, ...props }: InlineCodeProps) {
    const [copied, setCopied] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    // Convert children to string and clean trailing newlines
    const content = String(children).replace(/\n$/, '');

    // Check if content is a URL
    const isUrl = /^https?:\/\//i.test(content);

    /**
     * Get display text - shortened for URLs, full for other content
     * Example: https://www.google.com/search?q=test → google.com/search?q=test
     */
    const getDisplayText = () => {
        if (!isUrl) return children;

        try {
            const url = new URL(content);
            // Remove 'www.' prefix and show hostname + path
            const hostname = url.hostname.replace(/^www\./, '');
            const path = url.pathname === '/' ? '' : url.pathname;
            return `${hostname}${path}`;
        } catch {
            // If URL parsing fails, return original content
            return children;
        }
    };

    /**
     * Handle click - open URL in new tab OR copy to clipboard
     */
    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isUrl) {
            // Open URL in new tab
            window.open(content, '_blank', 'noopener,noreferrer');
        } else {
            // Copy non-URL content to clipboard
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
                onKeyDown={(e) => {
                    // Keyboard accessibility
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClick(e as unknown as React.MouseEvent);
                    }
                }}
                role="button"
                tabIndex={0}
                title={isUrl ? content : undefined} // Full URL on hover for links
                {...props}
            >
                {getDisplayText()}
            </code>

            {/* Animated tooltip */}
            <AnimatePresence>
                {(showTooltip || copied) && (
                    <motion.span
                        key="tooltip"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        className={`inline-code-tooltip ${copied ? 'inline-code-tooltip-success' : ''}`}
                    >
                        {copied ? '✓ Copied!' : isUrl ? 'Click to open' : 'Click to copy'}
                    </motion.span>
                )}
            </AnimatePresence>
        </span>
    );
}
