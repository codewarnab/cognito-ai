/**
 * Search Controls Component
 * Combined search controls for the composer.
 * Shows search toggle and depth selector in a compact horizontal layout.
 */

import React from 'react';
import { SearchModeToggle } from './SearchModeToggle';
import { SearchDepthSelector } from './SearchDepthSelector';
import { useSearchMode } from '@/hooks/useSearchMode';
import { createLogger } from '~logger';
import type { WorkflowDefinition } from '@/workflows/types';

const log = createLogger('SearchControls', 'SEARCH');

export interface SearchControlsProps {
    /** Additional CSS classes */
    className?: string;
    /** Active workflow - disables search toggle when present */
    activeWorkflow?: WorkflowDefinition | null;
    /** Whether adaptive mode is active - hides search controls entirely */
    isAdaptiveMode?: boolean;
}

export const SearchControls: React.FC<SearchControlsProps> = ({ className, activeWorkflow, isAdaptiveMode }) => {
    const {
        isSearchMode,
        toggleSearchMode,
        searchDepth,
        setSearchDepth,
        hasApiKey,
        isLoading,
    } = useSearchMode();

    // Hide search controls entirely in adaptive mode
    // Search tools are discoverable via discoverTools in that mode
    if (isAdaptiveMode) {
        return null;
    }

    // Debug logging
    log.info('🌐 SearchControls render', {
        isSearchMode,
        hasApiKey,
        isLoading,
        searchDepth,
        activeWorkflow: activeWorkflow?.name || null
    });

    const classNames = ['flex items-center gap-1', className].filter(Boolean).join(' ');

    return (
        <div className={classNames}>
            <SearchModeToggle
                isEnabled={isSearchMode}
                onToggle={toggleSearchMode}
                hasApiKey={hasApiKey}
                isLoading={isLoading}
                disabled={!!activeWorkflow}
                disabledReason={activeWorkflow ? `Search is disabled in ${activeWorkflow.name} mode` : undefined}
            />
            {/* Only show depth selector when search is enabled */}
            {isSearchMode && hasApiKey && (
                <SearchDepthSelector
                    value={searchDepth}
                    onChange={setSearchDepth}
                    disabled={isLoading}
                />
            )}
        </div>
    );
};

export default SearchControls;
