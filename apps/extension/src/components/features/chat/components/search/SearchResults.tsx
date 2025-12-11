/**
 * Search Results Component
 * Displays search results in grid or list format.
 * Optimized for sidepanel width (~400px).
 */

import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { SearchResultItem } from '@/search/types';
import '@/styles/features/search/search-results.css';

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
    return parts.length > 1 ? parts[0] : domain;
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
            <div className="search-results__list">
                {displayedResults.map((result, index) => (
                    <a
                        key={`${result.url}-${index}`}
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="search-result-card search-result-card--list"
                    >
                        <img
                            src={getFaviconUrl(result.url)}
                            alt=""
                            className="search-result-card__favicon"
                            onError={handleFaviconError}
                        />
                        <div className="search-result-card__content">
                            <div className="search-result-card__title">
                                {result.title || getDomain(result.url)}
                            </div>
                            <div className="search-result-card__snippet">
                                {result.content}
                            </div>
                            <div className="search-result-card__meta">
                                <span>{getDomain(result.url)}</span>
                                <span>•</span>
                                <span>{index + 1}</span>
                            </div>
                        </div>
                        <ExternalLink size={12} className="search-result-card__external-link" />
                    </a>
                ))}
            </div>
        );
    }

    return (
        <div className="search-results">
            <div className="search-results__grid">
                {displayedResults.map((result, index) => (
                    <a
                        key={`${result.url}-${index}`}
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="search-result-card search-result-card--grid"
                    >
                        <div className="search-result-card__title">
                            {result.title || result.content}
                        </div>
                        <div className="search-result-card__meta">
                            <img
                                src={getFaviconUrl(result.url)}
                                alt=""
                                className="search-result-card__favicon"
                                onError={handleFaviconError}
                            />
                            <span className="search-result-card__domain">
                                {getShortDomain(result.url)} • {index + 1}
                            </span>
                        </div>
                    </a>
                ))}

                {!showAll && hiddenCount > 0 && (
                    <button
                        type="button"
                        onClick={() => setShowAll(true)}
                        className="search-results__view-more"
                    >
                        View {hiddenCount} more
                    </button>
                )}
            </div>
        </div>
    );
};

export default SearchResults;
