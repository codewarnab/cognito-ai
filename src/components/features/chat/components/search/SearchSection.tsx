/**
 * Search Section Component
 * Collapsible section displaying search results.
 * Shows query, result count, and expandable results grid.
 */

import React from 'react';
import { ChevronDown, Search, Check, Loader2 } from 'lucide-react';
import type { SearchResults as SearchResultsType } from '@/search/types';
import { SearchResults } from './SearchResults';
import { SearchResultsImageSection } from './SearchResultsImageSection';
import '@/styles/features/search/search-section.css';

/** Tool invocation state for search operations */
interface SearchToolInvocation {
    state: 'call' | 'result';
    args: unknown;
    result?: SearchResultsType;
}

export interface SearchSectionProps {
    /** Tool invocation data from AI SDK */
    tool: SearchToolInvocation;
    /** Whether the section is expanded */
    isOpen: boolean;
    /** Callback when open state changes */
    onOpenChange: (open: boolean) => void;
}

interface SearchToolArgs {
    query?: string;
    include_domains?: string[];
}

/**
 * Loading skeleton for search results.
 */
const SearchSkeleton: React.FC = () => (
    <div className="search-section__skeleton">
        <div className="search-section__skeleton-grid">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="search-section__skeleton-item" />
            ))}
        </div>
    </div>
);

export const SearchSection: React.FC<SearchSectionProps> = ({
    tool,
    isOpen,
    onOpenChange,
}) => {
    const isLoading = tool.state === 'call';
    const searchResults: SearchResultsType | undefined = 
        tool.state === 'result' ? tool.result : undefined;
    
    const args = tool.args as SearchToolArgs;
    const query = args?.query || '';
    const includeDomains = args?.include_domains;
    
    const headerText = includeDomains?.length 
        ? `${query} [${includeDomains.join(', ')}]`
        : query;
    
    const resultCount = searchResults?.results?.length || 0;
    const hasImages = (searchResults?.images?.length || 0) > 0;

    const iconClasses = [
        'search-section__icon',
        isLoading && 'search-section__icon--loading',
    ].filter(Boolean).join(' ');
    
    const chevronClasses = [
        'search-section__chevron',
        isOpen && 'search-section__chevron--open',
    ].filter(Boolean).join(' ');

    return (
        <div className="search-section">
            <button
                type="button"
                onClick={() => onOpenChange(!isOpen)}
                aria-expanded={isOpen}
                aria-label={`Search results for ${query}`}
                className="search-section__header"
            >
                <div className={iconClasses}>
                    {isLoading ? (
                        <Loader2 size={14} />
                    ) : (
                        <Search size={14} />
                    )}
                </div>

                <span className="search-section__query">
                    {headerText || 'Searching...'}
                </span>

                {!isLoading && resultCount > 0 && (
                    <span className="search-section__badge">
                        <Check size={10} />
                        {resultCount} results
                    </span>
                )}

                <ChevronDown size={16} className={chevronClasses} />
            </button>

            {isOpen && (
                <div className="search-section__content">
                    {isLoading ? (
                        <SearchSkeleton />
                    ) : searchResults ? (
                        <div className="search-section__content-inner">
                            {hasImages && (
                                <SearchResultsImageSection
                                    images={searchResults.images}
                                    query={query}
                                />
                            )}
                            
                            {resultCount > 0 && (
                                <div>
                                    <div className="search-section__sources-label">
                                        Sources
                                    </div>
                                    <SearchResults results={searchResults.results} />
                                </div>
                            )}
                            
                            {resultCount === 0 && !hasImages && (
                                <div className="search-section__no-results">
                                    No results found for "{query}"
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
};

export default SearchSection;
