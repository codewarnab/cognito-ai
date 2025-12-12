/**
 * Citation List Component
 * Collapsible list of all sources cited in a message
 */

import React, { useState } from 'react';
import { Newspaper, ExternalLink } from 'lucide-react';
import type { CitationSource } from './SourceCitation';

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

    return (
        <div className={`mt-3 border-t border-[var(--border-color,#e5e7eb)] pt-3 ${className || ''}`}>
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${sources.length} sources`}
                className="flex items-center gap-1.5 w-full p-0 bg-transparent border-0 text-xs text-[var(--text-secondary,#6b7280)] cursor-pointer transition-colors duration-150 hover:text-[var(--text-primary,#374151)] focus:outline-none"
            >
                <Newspaper size={12} />
                <span>{sources.length} source{sources.length !== 1 ? 's' : ''}</span>
                <span className={`ml-auto text-[10px] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {isExpanded && (
                <div className="mt-2 flex flex-col gap-1">
                    {sources.map((source) => (
                        <a
                            key={source.number}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-1.5 rounded-md no-underline transition-colors duration-100 hover:bg-[var(--bg-hover,#f3f4f6)] group"
                        >
                            <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-[10px] font-medium bg-blue-500/10 text-blue-600 rounded-sm">
                                {source.number}
                            </span>
                            <img
                                src={source.favicon || getFaviconUrl(source.url)}
                                alt=""
                                className="flex-shrink-0 w-3 h-3 rounded-sm"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            <span className="flex-1 text-xs text-[var(--text-primary,#374151)] overflow-hidden text-ellipsis whitespace-nowrap">
                                {source.title}
                            </span>
                            <ExternalLink size={10} className="flex-shrink-0 opacity-0 text-[var(--text-tertiary,#9ca3af)] transition-opacity duration-150 group-hover:opacity-100" />
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CitationList;
