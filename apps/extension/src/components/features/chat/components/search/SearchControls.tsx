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
import '@/styles/features/search/search-controls.css';

const log = createLogger('SearchControls', 'SEARCH');

export interface SearchControlsProps {
    /** Additional CSS classes */
    className?: string;
    /** Active workflow - disables search toggle when present */
    activeWorkflow?: WorkflowDefinition | null;
}

export const SearchControls: React.FC<SearchControlsProps> = ({ className, activeWorkflow }) => {
    const {
        isSearchMode,
        toggleSearchMode,
        searchDepth,
        setSearchDepth,
        hasApiKey,
        isLoading,
    } = useSearchMode();

    // Debug logging
    log.info('🌐 SearchControls render', {
        isSearchMode,
        hasApiKey,
        isLoading,
        searchDepth,
        activeWorkflow: activeWorkflow?.name || null
    });

    const classNames = ['search-controls', className].filter(Boolean).join(' ');

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
