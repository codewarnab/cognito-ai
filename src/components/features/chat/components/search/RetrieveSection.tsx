/**
 * Retrieve Section Component
 * Collapsible section displaying URL retrieval results.
 * Similar to SearchSection but for single URL content.
 */

import React from 'react';
import { ChevronDown, Link, Check, Loader2 } from 'lucide-react';
import type { SearchResults as SearchResultsType } from '@/search/types';
import { SearchResults } from './SearchResults';
import '@/styles/features/search/retrieve-section.css';

/** Tool invocation state for retrieve operations */
interface RetrieveToolInvocation {
    state: 'call' | 'result';
    args: unknown;
    result?: SearchResultsType;
}

export interface RetrieveSectionProps {
    /** Tool invocation data from AI SDK */
    tool: RetrieveToolInvocation;
    /** Whether the section is expanded */
    isOpen: boolean;
    /** Callback when open state changes */
    onOpenChange: (open: boolean) => void;
}

interface RetrieveToolArgs {
    url?: string;
}

/**
 * Extracts domain from URL for display.
 */
function getDomain(urlStr: string): string {
    try {
        return new URL(urlStr).hostname.replace('www.', '');
    } catch {
        return urlStr;
    }
}

export const RetrieveSection: React.FC<RetrieveSectionProps> = ({
    tool,
    isOpen,
    onOpenChange,
}) => {
    const isLoading = tool.state === 'call';
    const data: SearchResultsType | undefined = 
        tool.state === 'result' ? tool.result : undefined;
    
    const args = tool.args as RetrieveToolArgs;
    const url = args?.url || '';
    
    const hasResults = (data?.results?.length || 0) > 0;

    const iconClasses = [
        'retrieve-section__icon',
        isLoading && 'retrieve-section__icon--loading',
    ].filter(Boolean).join(' ');
    
    const chevronClasses = [
        'retrieve-section__chevron',
        isOpen && 'retrieve-section__chevron--open',
    ].filter(Boolean).join(' ');

    return (
        <div className="retrieve-section">
            <button
                type="button"
                onClick={() => onOpenChange(!isOpen)}
                aria-expanded={isOpen}
                aria-label={`Retrieved content from ${getDomain(url)}`}
                className="retrieve-section__header"
            >
                <div className={iconClasses}>
                    {isLoading ? (
                        <Loader2 size={14} />
                    ) : (
                        <Link size={14} />
                    )}
                </div>

                <span className="retrieve-section__url">
                    {getDomain(url) || 'Retrieving...'}
                </span>

                {!isLoading && hasResults && (
                    <span className="retrieve-section__badge">
                        <Check size={10} />
                        Retrieved
                    </span>
                )}

                <ChevronDown size={16} className={chevronClasses} />
            </button>

            {isOpen && (
                <div className="retrieve-section__content">
                    {isLoading ? (
                        <div className="retrieve-section__skeleton">
                            <div className="retrieve-section__skeleton-line retrieve-section__skeleton-line--short" />
                            <div className="retrieve-section__skeleton-line retrieve-section__skeleton-line--medium" />
                            <div className="retrieve-section__skeleton-line retrieve-section__skeleton-line--long" />
                        </div>
                    ) : data && hasResults ? (
                        <div className="retrieve-section__content-inner">
                            <div className="retrieve-section__content-label">
                                Content
                            </div>
                            <SearchResults 
                                results={data.results} 
                                displayMode="list" 
                            />
                        </div>
                    ) : (
                        <div className="retrieve-section__error">
                            Could not retrieve content from this URL
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RetrieveSection;
