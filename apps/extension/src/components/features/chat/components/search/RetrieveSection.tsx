/**
 * Retrieve Section Component
 * Collapsible section displaying URL retrieval results.
 * Similar to SearchSection but for single URL content.
 */

import React from 'react';
import { ChevronDown, Link, Check, Loader2 } from 'lucide-react';
import type { SearchResults as SearchResultsType } from '@/search/types';
import { SearchResults } from './SearchResults';

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

    return (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <button
                type="button"
                onClick={() => onOpenChange(!isOpen)}
                aria-expanded={isOpen}
                aria-label={`Retrieved content from ${getDomain(url)}`}
                className="w-full flex items-center gap-2 p-3 text-left bg-transparent border-0 cursor-pointer transition-colors duration-150 hover:bg-[var(--color-surface-hover)]"
            >
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-purple-500/10 text-purple-500 ${isLoading ? 'animate-spin' : ''}`}>
                    {isLoading ? (
                        <Loader2 size={14} />
                    ) : (
                        <Link size={14} />
                    )}
                </div>

                <span className="flex-1 min-w-0 text-sm text-[var(--color-text)] overflow-hidden text-ellipsis whitespace-nowrap">
                    {getDomain(url) || 'Retrieving...'}
                </span>

                {!isLoading && hasResults && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-500 rounded-full">
                        <Check size={10} />
                        Retrieved
                    </span>
                )}

                <ChevronDown
                    size={16}
                    className={`flex-shrink-0 text-[var(--color-text-secondary)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="border-t border-[var(--color-border)]">
                    {isLoading ? (
                        <div className="p-3 flex flex-col gap-2">
                            <div className="h-4 rounded bg-[var(--color-surface-hover)] animate-pulse w-3/4" />
                            <div className="h-4 rounded bg-[var(--color-surface-hover)] animate-pulse w-full" />
                            <div className="h-4 rounded bg-[var(--color-surface-hover)] animate-pulse w-2/3" />
                        </div>
                    ) : data && hasResults ? (
                        <div className="p-3">
                            <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
                                Content
                            </div>
                            <SearchResults
                                results={data.results}
                                displayMode="list"
                            />
                        </div>
                    ) : (
                        <div className="text-sm text-[var(--color-text-secondary)] text-center p-3">
                            Could not retrieve content from this URL
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RetrieveSection;
