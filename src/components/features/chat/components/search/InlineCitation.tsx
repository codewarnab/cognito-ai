/**
 * Inline Citation Component
 * Hoverable citation pill that displays source information
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ExternalLink } from 'lucide-react';
import type { CitationSource } from '@/utils/citations';
import { getFaviconUrl, getDomainFromUrl } from '@/utils/citations';
import '@/styles/features/search/inline-citation.css';

export interface InlineCitationProps {
    /** Citation source data */
    source: CitationSource;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Inline citation component that shows a numbered pill.
 * Displays a tooltip with source info on hover and opens URL on click.
 */
export const InlineCitation: React.FC<InlineCitationProps> = ({ source, className }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState<'above' | 'below'>('above');
    const tooltipRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const hideTimeoutRef = useRef<number | null>(null);

    const clearHideTimeout = useCallback(() => {
        if (hideTimeoutRef.current !== null) {
            window.clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
    }, []);

    const handleMouseEnter = useCallback(() => {
        clearHideTimeout();
        setShowTooltip(true);
    }, [clearHideTimeout]);

    const handleMouseLeave = useCallback(() => {
        clearHideTimeout();
        hideTimeoutRef.current = window.setTimeout(() => {
            setShowTooltip(false);
        }, 150);
    }, [clearHideTimeout]);

    /**
     * Position tooltip within viewport bounds
     */
    useEffect(() => {
        if (showTooltip && tooltipRef.current && triggerRef.current) {
            const trigger = triggerRef.current.getBoundingClientRect();
            const tooltip = tooltipRef.current;

            // Check if tooltip would go above viewport
            const spaceAbove = trigger.top;
            const tooltipHeight = tooltip.offsetHeight;

            if (spaceAbove < tooltipHeight + 10) {
                setTooltipPosition('below');
            } else {
                setTooltipPosition('above');
            }

            // Horizontal positioning
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

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (hideTimeoutRef.current !== null) {
                window.clearTimeout(hideTimeoutRef.current);
            }
        };
    }, []);

    const handleClick = () => {
        window.open(source.url, '_blank', 'noopener,noreferrer');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
        }
    };

    const containerClasses = ['inline-citation', className].filter(Boolean).join(' ');
    const tooltipClasses = [
        'inline-citation__tooltip',
        `inline-citation__tooltip--${tooltipPosition}`,
    ].join(' ');

    const faviconUrl = source.favicon || getFaviconUrl(source.url);
    const domain = getDomainFromUrl(source.url);

    return (
        <span
            className={containerClasses}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                ref={triggerRef}
                type="button"
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                onFocus={handleMouseEnter}
                onBlur={handleMouseLeave}
                aria-label={`Source ${source.number}: ${source.title}`}
                className="inline-citation__trigger"
            >
                {source.number}
            </button>

            {showTooltip && (
                <div
                    ref={tooltipRef}
                    role="tooltip"
                    className={tooltipClasses}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <div className="inline-citation__card">
                        <div className="inline-citation__header">
                            <img
                                src={faviconUrl}
                                alt=""
                                className="inline-citation__favicon"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            <div className="inline-citation__meta">
                                <div className="inline-citation__title">
                                    {source.title}
                                </div>
                                <div className="inline-citation__domain">
                                    <ExternalLink size={10} />
                                    <span>{domain}</span>
                                </div>
                            </div>
                        </div>
                        {source.snippet && (
                            <div className="inline-citation__snippet">
                                {source.snippet.length > 150
                                    ? `${source.snippet.substring(0, 150)}...`
                                    : source.snippet}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </span>
    );
};

export default InlineCitation;
