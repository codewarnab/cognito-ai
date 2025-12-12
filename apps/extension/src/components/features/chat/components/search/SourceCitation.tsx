/**
 * Source Citation Component
 * Inline citation badge with tooltip preview
 */

import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';

export interface CitationSource {
    /** Citation number (1, 2, 3...) */
    number: number;
    /** Source title */
    title: string;
    /** Source URL */
    url: string;
    /** Optional favicon URL */
    favicon?: string;
}

export interface SourceCitationProps {
    /** Citation data */
    source: CitationSource;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Inline citation component that shows a numbered reference.
 * Displays a tooltip preview on hover and opens URL on click.
 */
export const SourceCitation: React.FC<SourceCitationProps> = ({ source, className }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    /**
     * Extract domain from URL for display
     */
    const getDomain = (url: string): string => {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return url;
        }
    };

    /**
     * Get favicon URL from Google's favicon service
     */
    const getFaviconUrl = (url: string): string => {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
        } catch {
            return '';
        }
    };

    /**
     * Position tooltip within viewport bounds
     */
    useEffect(() => {
        if (showTooltip && tooltipRef.current && triggerRef.current) {
            const tooltip = tooltipRef.current;

            tooltip.style.left = '50%';
            tooltip.style.right = 'auto';
            tooltip.style.transform = 'translateX(-50%)';

            const tooltipRect = tooltip.getBoundingClientRect();
            if (tooltipRect.right > window.innerWidth - 10) {
                tooltip.style.left = 'auto';
                tooltip.style.right = '0';
                tooltip.style.transform = 'none';
            } else if (tooltipRect.left < 10) {
                tooltip.style.left = '0';
                tooltip.style.transform = 'none';
            }
        }
    }, [showTooltip]);

    const handleClick = () => {
        window.open(source.url, '_blank', 'noopener,noreferrer');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
        }
    };

    return (
        <span className={`inline-block relative ${className || ''}`}>
            <button
                ref={triggerRef}
                type="button"
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onFocus={() => setShowTooltip(true)}
                onBlur={() => setShowTooltip(false)}
                aria-label={`Source ${source.number}: ${source.title}`}
                className="inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-medium bg-blue-500/10 text-blue-600 rounded-sm border-0 cursor-pointer transition-colors duration-100 align-super -mt-1 hover:bg-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
                {source.number}
            </button>

            {showTooltip && (
                <div
                    ref={tooltipRef}
                    role="tooltip"
                    className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 w-[200px] p-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-lg pointer-events-none"
                >
                    <div className="flex items-start gap-2">
                        <img
                            src={source.favicon || getFaviconUrl(source.url)}
                            alt=""
                            className="flex-shrink-0 w-4 h-4 mt-0.5 rounded-sm"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                        <div className="overflow-hidden">
                            <div className="text-xs font-medium text-[var(--text-primary)] line-clamp-2">
                                {source.title}
                            </div>
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-[var(--text-secondary)]">
                                <ExternalLink size={10} />
                                <span className="overflow-hidden text-ellipsis whitespace-nowrap">{getDomain(source.url)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </span>
    );
};

export default SourceCitation;
