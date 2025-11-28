/**
 * Custom Tooltip Component
 * A styled tooltip that appears on hover, replacing native browser tooltips.
 */

import React, { useState, useRef, useEffect } from 'react';
import './tooltip.css';

export interface TooltipProps {
    /** The content to display in the tooltip */
    content: string;
    /** The element that triggers the tooltip */
    children: React.ReactElement;
    /** Position of the tooltip relative to the trigger */
    position?: 'top' | 'bottom' | 'left' | 'right';
    /** Delay before showing tooltip (ms) */
    delay?: number;
    /** Additional CSS classes */
    className?: string;
    /** Whether the tooltip is disabled */
    disabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
    content,
    children,
    position = 'top',
    delay = 300,
    className,
    disabled = false,
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<number | null>(null);

    const showTooltip = () => {
        if (disabled || !content) return;
        
        timeoutRef.current = window.setTimeout(() => {
            setIsVisible(true);
        }, delay);
    };

    const hideTooltip = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsVisible(false);
    };

    useEffect(() => {
        if (!isVisible || !triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const padding = 8;

        let top = 0;
        let left = 0;

        switch (position) {
            case 'top':
                top = triggerRect.top - tooltipRect.height - padding;
                left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                break;
            case 'bottom':
                top = triggerRect.bottom + padding;
                left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                break;
            case 'left':
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                left = triggerRect.left - tooltipRect.width - padding;
                break;
            case 'right':
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                left = triggerRect.right + padding;
                break;
        }

        // Keep tooltip within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (left < padding) left = padding;
        if (left + tooltipRect.width > viewportWidth - padding) {
            left = viewportWidth - tooltipRect.width - padding;
        }
        if (top < padding) top = padding;
        if (top + tooltipRect.height > viewportHeight - padding) {
            top = viewportHeight - tooltipRect.height - padding;
        }

        setCoords({ top, left });
    }, [isVisible, position]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <>
            <div
                ref={triggerRef}
                className="tooltip-trigger"
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
            >
                {children}
            </div>
            {isVisible && (
                <div
                    ref={tooltipRef}
                    className={`tooltip tooltip--${position} ${className || ''}`}
                    style={{ top: coords.top, left: coords.left }}
                    role="tooltip"
                >
                    {content}
                </div>
            )}
        </>
    );
};

export default Tooltip;
