import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface InlineCodeProps {
    children: React.ReactNode;
    [key: string]: unknown;
}

// Custom inline code component with tooltip and copy functionality
export function InlineCode({ children, ...props }: InlineCodeProps) {
    const [copied, setCopied] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    const content = String(children).replace(/\n$/, '');
    const isUrl = /^https?:\/\//i.test(content);

    const getDisplayText = () => {
        if (!isUrl) return children;

        try {
            const url = new URL(content);
            const hostname = url.hostname.replace(/^www\./, '');
            const path = url.pathname === '/' ? '' : url.pathname;
            return `${hostname}${path}`;
        } catch {
            return children;
        }
    };

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isUrl) {
            window.open(content, '_blank', 'noopener,noreferrer');
        } else {
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
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClick(e as unknown as React.MouseEvent);
                    }
                }}
                role="button"
                tabIndex={0}
                title={isUrl ? content : undefined}
                {...props}
            >
                {getDisplayText()}
            </code>
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
