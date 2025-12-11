/**
 * Source Citation Component
 * Inline citation badge with tooltip preview
 */

import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import '@/styles/features/search/source-citation.css';

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

    const containerClasses = ['source-citation', className].filter(Boolean).join(' ');

    return (
        <span className={containerClasses}>
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
                className="source-citation__trigger"
            >
                {source.number}
            </button>

            {showTooltip && (
                <div ref={tooltipRef} role="tooltip" className="source-citation__tooltip">
                    <div className="source-citation__tooltip-content">
                        <img
                            src={source.favicon || getFaviconUrl(source.url)}
                            alt=""
                            className="source-citation__favicon"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                        <div className="source-citation__info">
                            <div className="source-citation__title">
                                {source.title}
                            </div>
                            <div className="source-citation__url">
                                <ExternalLink size={10} />
                                <span>{getDomain(source.url)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </span>
    );
};

export default SourceCitation;
