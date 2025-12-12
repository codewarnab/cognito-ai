/**
 * Search Results Component
 * Displays search results in grid or list format.
 * Optimized for sidepanel width (~400px).
 */

import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { SearchResultItem } from '@/search/types';

export interface SearchResultsProps {
    /** Array of search results */
    results: SearchResultItem[];
    /** Display mode - grid for compact, list for detailed */
    displayMode?: 'grid' | 'list';
    /** Maximum results to show initially in grid mode */
    initialCount?: number;
}

/**
 * Extracts domain from URL for display.
 */
function getDomain(url: string): string {
    try {
        const hostname = new URL(url).hostname;
        return hostname.replace('www.', '');
    } catch {
        return url;
    }
}

/**
 * Gets short domain name for display.
 */
function getShortDomain(url: string): string {
    const domain = getDomain(url);
    const parts = domain.split('.');
    return parts.length > 1 ? (parts[0] ?? domain) : domain;
}

/**
 * Gets favicon URL from Google's favicon service.
 */
function getFaviconUrl(url: string): string {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
        return '';
    }
}

export const SearchResults: React.FC<SearchResultsProps> = ({
    results,
    displayMode = 'grid',
    initialCount = 4,
}) => {
    const [showAll, setShowAll] = useState(false);

    if (results.length === 0) {
        return null;
    }

    const displayedResults = displayMode === 'grid' && !showAll
        ? results.slice(0, initialCount)
        : results;

    const hiddenCount = results.length - initialCount;

    const handleFaviconError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        (e.target as HTMLImageElement).style.display = 'none';
    };

    if (displayMode === 'list') {
        return (
            <div className="flex flex-col gap-2">
                {displayedResults.map((result, index) => (
                    <a
                        key={`${result.url}-${index}`}
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 p-2 rounded-lg border border-[var(--color-border)] no-underline transition-colors duration-150 hover:bg-[var(--color-surface-hover)]"
                    >
                        <img
                            src={getFaviconUrl(result.url)}
                            alt=""
                            className="flex-shrink-0 w-4 h-4 mt-0.5 rounded-sm"
                            onError={handleFaviconError}
                        />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[var(--color-text)] line-clamp-1">
                                {result.title || getDomain(result.url)}
                            </div>
                            <div className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mt-0.5">
                                {result.content}
                            </div>
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-[var(--color-text-tertiary)]">
                                <span>{getDomain(result.url)}</span>
                                <span>•</span>
                                <span>{index + 1}</span>
                            </div>
                        </div>
                        <ExternalLink size={12} className="flex-shrink-0 opacity-0 text-[var(--color-text-tertiary)] mt-0.5 transition-opacity duration-150 group-hover:opacity-100" />
                    </a>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
                {displayedResults.map((result, index) => (
                    <a
                        key={`${result.url}-${index}`}
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2 rounded-lg border border-[var(--color-border)] no-underline transition-colors duration-150 hover:bg-[var(--color-surface-hover)]"
                    >
                        <div className="text-xs text-[var(--color-text)] line-clamp-2 min-h-[32px]">
                            {result.title || result.content}
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                            <img
                                src={getFaviconUrl(result.url)}
                                alt=""
                                className="flex-shrink-0 w-3 h-3 rounded-sm"
                                onError={handleFaviconError}
                            />
                            <span className="text-[10px] text-[var(--color-text-secondary)] overflow-hidden text-ellipsis whitespace-nowrap">
                                {getShortDomain(result.url)} • {index + 1}
                            </span>
                        </div>
                    </a>
                ))}

                {!showAll && hiddenCount > 0 && (
                    <button
                        type="button"
                        onClick={() => setShowAll(true)}
                        className="flex items-center justify-center p-2 rounded-lg border border-[var(--color-border)] bg-transparent text-xs text-[var(--color-text-secondary)] cursor-pointer transition-colors duration-150 hover:bg-[var(--color-surface-hover)]"
                    >
                        View {hiddenCount} more
                    </button>
                )}
            </div>
        </div>
    );
};

export default SearchResults;
