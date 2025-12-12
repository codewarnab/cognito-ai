/**
 * Inline Citation Component
 * Hoverable citation pill that displays source information
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ExternalLink } from 'lucide-react';
import type { CitationSource } from '@/utils/citations';
import { getFaviconUrl, getDomainFromUrl } from '@/utils/citations';

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

    const faviconUrl = source.favicon || getFaviconUrl(source.url);
    const domain = getDomainFromUrl(source.url);

    const tooltipPositionClasses = tooltipPosition === 'above'
        ? 'bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2'
        : 'top-[calc(100%+8px)] left-1/2 -translate-x-1/2';

    return (
        <span
            className={`inline relative ${className || ''}`}
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
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px] mx-px text-[11px] font-semibold leading-none text-blue-600 bg-blue-500/10 border-0 rounded-[9px] cursor-pointer transition-all duration-150 align-middle font-inherit hover:bg-blue-500/20 hover:text-blue-700 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/30 active:scale-[0.98]"
            >
                {source.number}
            </button>

            {showTooltip && (
                <div
                    ref={tooltipRef}
                    role="tooltip"
                    className={`absolute z-[100] w-[280px] pointer-events-auto ${tooltipPositionClasses}`}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.15)] overflow-hidden animate-[citation-fade-in_150ms_ease]">
                        <div className="flex items-start gap-2.5 p-3">
                            <img
                                src={faviconUrl}
                                alt=""
                                className="flex-shrink-0 w-5 h-5 rounded mt-0.5"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="text-[13px] font-medium text-[var(--text-primary)] leading-[1.4] line-clamp-2">
                                    {source.title}
                                </div>
                                <div className="flex items-center gap-1 mt-1 text-[11px] text-[var(--text-tertiary)]">
                                    <ExternalLink size={10} />
                                    <span className="overflow-hidden text-ellipsis whitespace-nowrap">{domain}</span>
                                </div>
                            </div>
                        </div>
                        {source.snippet && (
                            <div className="px-3 pb-3 pt-2.5 -mt-0.5 text-xs leading-[1.5] text-[var(--text-secondary)] border-t border-[var(--border-color-light,#f3f4f6)]">
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
