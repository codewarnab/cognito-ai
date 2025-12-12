/**
 * Search Mode Toggle Component
 * Minimal toggle button for enabling/disabling web search mode.
 * Designed for Chrome sidepanel - compact with clear visual feedback.
 */

import React from 'react';
import { Globe } from 'lucide-react';
import { Tooltip } from '@/components/ui/primitives/tooltip';

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
            ? 'Add tavily API key in Settings to enable web search'
            : isEnabled
                ? 'Web search enabled - AI can search the internet'
                : 'Click to enable web search';

    const baseClasses = 'inline-flex items-center justify-center gap-1 py-1 px-2 rounded-full text-xs font-medium transition-all duration-150 border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed';

    const stateClasses = !hasApiKey
        ? 'opacity-40 text-[var(--text-tertiary)] border-[var(--border-color)]'
        : isEnabled && hasApiKey
            ? 'bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25'
            : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--color-surface)] hover:text-[var(--text-primary)]';

    const loadingClasses = isLoading ? 'animate-pulse' : '';

    const classNames = [baseClasses, stateClasses, loadingClasses, className].filter(Boolean).join(' ');

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
                <Globe size={14} className={`transition-colors duration-150 ${isEnabled && hasApiKey ? 'text-blue-500' : ''}`} />
                <span className="hidden min-[400px]:inline">Search</span>
            </button>
        </Tooltip>
    );
};

export default SearchModeToggle;
