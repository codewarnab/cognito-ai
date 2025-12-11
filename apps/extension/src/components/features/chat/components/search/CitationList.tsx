/**
 * Citation List Component
 * Collapsible list of all sources cited in a message
 */

import React, { useState } from 'react';
import { Newspaper, ExternalLink } from 'lucide-react';
import type { CitationSource } from './SourceCitation';
import '@/styles/features/search/citation-list.css';

export interface CitationListProps {
    /** Array of citation sources */
    sources: CitationSource[];
    /** Whether the list is collapsed by default */
    defaultCollapsed?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Compact list of all sources cited in a message.
 * Displayed at the end of AI responses that include citations.
 */
export const CitationList: React.FC<CitationListProps> = ({
    sources,
    defaultCollapsed = true,
    className,
}) => {
    const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);

    if (sources.length === 0) return null;

    /**
     * Get favicon URL from Google's favicon service
     */
    const getFaviconUrl = (url: string): string => {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
        } catch {
            return '';
        }
    };

    const containerClasses = ['citation-list', className].filter(Boolean).join(' ');
    const chevronClasses = [
        'citation-list__chevron',
        isExpanded && 'citation-list__chevron--open',
    ].filter(Boolean).join(' ');

    return (
        <div className={containerClasses}>
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${sources.length} sources`}
                className="citation-list__header"
            >
                <Newspaper size={12} />
                <span>{sources.length} source{sources.length !== 1 ? 's' : ''}</span>
                <span className={chevronClasses}>▼</span>
            </button>

            {isExpanded && (
                <div className="citation-list__items">
                    {sources.map((source) => (
                        <a
                            key={source.number}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="citation-list__item"
                        >
                            <span className="citation-list__number">
                                {source.number}
                            </span>
                            <img
                                src={source.favicon || getFaviconUrl(source.url)}
                                alt=""
                                className="citation-list__favicon"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            <span className="citation-list__title">
                                {source.title}
                            </span>
                            <ExternalLink size={10} className="citation-list__link-icon" />
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CitationList;
