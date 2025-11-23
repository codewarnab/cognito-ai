/**
 * Search Bookmarks Tool
 * Allows AI to search bookmarks by query
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { createLogger } from '~logger';
import { CompactToolRenderer } from '../../ai/tools/components';
import type { ToolUIState } from '../../ai/tools/components';
import { safeBookmarksSearch, safeBookmarksGet } from '../chromeApi/bookmarks';
import { BrowserAPIError } from '../../errors';
import type { BookmarkSearchResults } from '../../types/bookmarks';

const log = createLogger('Tool-SearchBookmarks');

/**
 * Helper to get the folder path for a bookmark
 */
async function getBookmarkPath(bookmarkId: string): Promise<string> {
    try {
        const bookmarks = await safeBookmarksGet(bookmarkId);
        if (bookmarks.length === 0) return 'Unknown';

        const bookmark = bookmarks[0];
        if (!bookmark) return 'Unknown';
        if (!bookmark.parentId) return 'Root';

        // Traverse up the tree to build path
        const pathParts: string[] = [];
        let currentId: string | undefined = bookmark.parentId;

        while (currentId && currentId !== '0') {
            const parents = await safeBookmarksGet(currentId);
            if (parents.length === 0) break;

            const parent = parents[0];
            if (!parent) break;
            pathParts.unshift(parent.title || 'Unnamed');
            currentId = parent.parentId;
        }

        return pathParts.join(' > ') || 'Other bookmarks';
    } catch (error) {
        log.warn('Failed to get bookmark path:', error);
        return 'Unknown';
    }
}

/**
 * Hook to register the searchBookmarks tool
 */
export function useSearchBookmarks() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering searchBookmarks tool...');

        registerTool({
            name: 'searchBookmarks',
            description: `Search bookmarks by query (searches title and URL). Use when user asks "find bookmark", "search my bookmarks", "do I have a bookmark for X". Returns matching bookmarks with paths. Searches all folders recursively. Returns max 50 results sorted by relevance.`,

            parameters: z.object({
                query: z.string().describe('Search query. Searches in bookmark titles and URLs. Case-insensitive. Examples: "github", "react docs", "example.com"'),
                limit: z.number().optional().default(10).describe('Max results to return (1-50, default 10)')
            }),

            execute: async ({ query, limit = 10 }): Promise<BookmarkSearchResults> => {
                try {
                    log.info('TOOL CALL: searchBookmarks', { query, limit });

                    const results = await safeBookmarksSearch(query);
                    const actualLimit = Math.min(Math.max(1, limit), 50);
                    const limited = results.slice(0, actualLimit);

                    // Enrich with folder paths (in parallel)
                    const enriched = await Promise.all(
                        limited.map(async (bookmark) => {
                            const path = await getBookmarkPath(bookmark.id);
                            return {
                                id: bookmark.id,
                                title: bookmark.title,
                                url: bookmark.url,
                                path: path,
                                dateAdded: bookmark.dateAdded
                            };
                        })
                    );

                    log.info('✅ Found bookmarks', { count: enriched.length, total: results.length });

                    return {
                        success: true,
                        count: enriched.length,
                        total: results.length,
                        bookmarks: enriched
                    };
                } catch (error) {
                    log.error('[Tool] Error searching bookmarks:', error);

                    if (error instanceof BrowserAPIError) {
                        throw error;
                    }

                    throw new Error(error instanceof Error ? error.message : 'Failed to search bookmarks');
                }
            },
        });

        // Register the UI renderer
        registerToolUI('searchBookmarks', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        }, {
            renderInput: (input: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span style={{ opacity: 0.7 }}>Query:</span>
                    <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                        "{input.query}"
                    </span>
                </div>
            ),
            renderOutput: (output: any) => (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {output.success ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ opacity: 0.7 }}>
                                Found {output.count} result{output.count !== 1 ? 's' : ''}
                                {output.total > output.count && ` (${output.total} total)`}
                            </div>
                            {output.bookmarks && output.bookmarks.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                                    {output.bookmarks.map((bookmark: any, idx: number) => (
                                        <div key={idx} style={{
                                            padding: '6px 8px',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: '3px',
                                            border: '1px solid var(--border-color)',
                                            fontSize: '11px'
                                        }}>
                                            <div style={{ color: 'var(--text-primary)', opacity: 0.9, marginBottom: '2px' }}>
                                                {bookmark.title}
                                            </div>
                                            {bookmark.url && (
                                                <a href={bookmark.url} target="_blank" rel="noopener noreferrer"
                                                    style={{ fontSize: '10px', opacity: 0.6, textDecoration: 'none' }}>
                                                    {bookmark.url}
                                                </a>
                                            )}
                                            {bookmark.path && (
                                                <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '2px' }}>
                                                    📁 {bookmark.path}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <span style={{ color: 'var(--error-color)' }}>Failed to search bookmarks</span>
                    )}
                </div>
            )
        });

        log.info('✅ searchBookmarks tool registration complete');

        return () => {
            log.info('🧹 Cleaning up searchBookmarks tool');
            unregisterToolUI('searchBookmarks');
        };
    }, []);
}
