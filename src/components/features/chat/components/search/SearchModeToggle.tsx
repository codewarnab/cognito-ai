/**
 * Search Mode Toggle Component
 * Minimal toggle button for enabling/disabling web search mode.
 * Designed for Chrome sidepanel - compact with clear visual feedback.
 */

import React from 'react';
import { Globe } from 'lucide-react';
import { Tooltip } from '@/components/ui/primitives/tooltip';
import '@/styles/features/search/search-mode-toggle.css';

export interface SearchModeToggleProps {
    /** Whether search mode is enabled */
    isEnabled: boolean;
    /** Callback when toggle is clicked */
    onToggle: () => void;
    /** Whether API key is configured */
    hasApiKey: boolean;
    /** Whether the component is in loading state */
    isLoading?: boolean;
    /** Whether the toggle is disabled (e.g., when a workflow is active) */
    disabled?: boolean;
    /** Reason why the toggle is disabled (shown in tooltip) */
    disabledReason?: string;
    /** Additional CSS classes */
    className?: string;
}

export const SearchModeToggle: React.FC<SearchModeToggleProps> = ({
    isEnabled,
    onToggle,
    hasApiKey,
    isLoading = false,
    disabled = false,
    disabledReason,
    className,
}) => {
    const handleClick = () => {
        if (!isLoading && hasApiKey && !disabled) {
            onToggle();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isLoading && hasApiKey && !disabled) {
            e.preventDefault();
            onToggle();
        }
    };

    const tooltipContent = disabled && disabledReason
        ? disabledReason
        : !hasApiKey
            ? 'Add API key in Settings to enable web search'
            : isEnabled
                ? 'Web search enabled - AI can search the internet'
                : 'Click to enable web search';

    const classNames = [
        'search-mode-toggle',
        isLoading && 'search-mode-toggle--loading',
        isEnabled && hasApiKey && 'search-mode-toggle--enabled',
        !hasApiKey && 'search-mode-toggle--disabled',
        !isEnabled && hasApiKey && 'search-mode-toggle--inactive',
        className,
    ].filter(Boolean).join(' ');

    return (
        <Tooltip content={tooltipContent} position="top">
            <button
                type="button"
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                disabled={isLoading || !hasApiKey || disabled}
                aria-label={isEnabled ? 'Disable web search' : 'Enable web search'}
                aria-pressed={isEnabled}
                className={classNames}
            >
                <Globe size={14} className="search-mode-toggle__icon" />
                <span className="search-mode-toggle__label">Search</span>
            </button>
        </Tooltip>
    );
};

export default SearchModeToggle;
