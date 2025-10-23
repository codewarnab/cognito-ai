/**
 * Chrome Search Tool for AI SDK v5
 * Uses Chrome's search API to search across bookmarks, history, and open tabs
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { CompactToolRenderer } from '../../ai/CompactToolRenderer';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger('Tool-ChromeSearch');

/**
 * Hook to register the chromeSearch tool
 */
export function useChromeSearchTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering chromeSearch tool...');

        // Register the tool with AI SDK v5
        registerTool({
            name: 'chromeSearch',
            description: 'Search across Chrome bookmarks, browsing history, and open tabs using Chrome\'s built-in search API. Returns structured results with titles, URLs, and types.',
            parameters: z.object({
                query: z.string().describe('The search query to find in bookmarks, history, or tabs'),
                maxResults: z.number()
                    .max(100)
                    .describe('Maximum number of results to return (default: 20)')
                    .default(20),
                includeTabs: z.boolean()
                    .describe('Include open tabs in search results')
                    .default(true),
                includeBookmarks: z.boolean()
                    .describe('Include bookmarks in search results')
                    .default(true),
                includeHistory: z.boolean()
                    .describe('Include browsing history in search results')
                    .default(true),
            }),
            execute: async ({ query, maxResults = 20, includeTabs = true, includeBookmarks = true, includeHistory = true }) => {
                try {
                    log.info("TOOL CALL: chromeSearch", { query, maxResults, includeTabs, includeBookmarks, includeHistory });

                    const results: any[] = [];

                    // Search open tabs if requested
                    if (includeTabs) {
                        try {
                            const tabs = await chrome.tabs.query({});
                            const tabResults = tabs
                                .filter(tab => {
                                    const title = tab.title?.toLowerCase() || '';
                                    const url = tab.url?.toLowerCase() || '';
                                    const queryLower = query.toLowerCase();
                                    return title.includes(queryLower) || url.includes(queryLower);
                                })
                                .slice(0, maxResults)
                                .map(tab => ({
                                    type: 'tab',
                                    title: tab.title || 'Untitled',
                                    url: tab.url || '',
                                    tabId: tab.id,
                                    windowId: tab.windowId,
                                    active: tab.active,
                                    favIconUrl: tab.favIconUrl
                                }));
                            results.push(...tabResults);
                        } catch (error) {
                            log.warn('Failed to search tabs:', error);
                        }
                    }

                    // Search bookmarks if requested
                    if (includeBookmarks) {
                        try {
                            const bookmarkResults = await chrome.bookmarks.search(query);
                            const bookmarkItems = bookmarkResults
                                .filter(bookmark => bookmark.url) // Only bookmarks with URLs
                                .slice(0, maxResults)
                                .map(bookmark => ({
                                    type: 'bookmark',
                                    title: bookmark.title || 'Untitled Bookmark',
                                    url: bookmark.url!,
                                    id: bookmark.id,
                                    dateAdded: bookmark.dateAdded,
                                    parentId: bookmark.parentId
                                }));
                            results.push(...bookmarkItems);
                        } catch (error) {
                            log.warn('Failed to search bookmarks:', error);
                        }
                    }

                    // Search history if requested
                    if (includeHistory) {
                        try {
                            const historyResults = await chrome.history.search({
                                text: query,
                                maxResults: maxResults,
                                startTime: Date.now() - (30 * 24 * 60 * 60 * 1000) // Last 30 days
                            });
                            const historyItems = historyResults
                                .map(item => ({
                                    type: 'history',
                                    title: item.title || 'Untitled Page',
                                    url: item.url!,
                                    visitCount: item.visitCount,
                                    lastVisitTime: item.lastVisitTime
                                }));
                            results.push(...historyItems);
                        } catch (error) {
                            log.warn('Failed to search history:', error);
                        }
                    }

                    // Remove duplicates based on URL and limit results
                    const uniqueResults = results
                        .filter((item, index, self) =>
                            index === self.findIndex(other => other.url === item.url)
                        )
                        .slice(0, maxResults);

                    log.info('🔍 Chrome search completed', {
                        query,
                        totalResults: uniqueResults.length,
                        tabs: uniqueResults.filter(r => r.type === 'tab').length,
                        bookmarks: uniqueResults.filter(r => r.type === 'bookmark').length,
                        history: uniqueResults.filter(r => r.type === 'history').length
                    });

                    return {
                        success: true,
                        query,
                        results: uniqueResults,
                        totalCount: uniqueResults.length
                    };

                } catch (error) {
                    log.error('[Tool] Error searching Chrome:', error);
                    return {
                        error: "Failed to search Chrome",
                        details: String(error),
                        success: false
                    };
                }
            },
        });

        // Register the UI renderer for this tool
        registerToolUI('chromeSearch', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        });

        log.info('✅ chromeSearch tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up chromeSearch tool');
            unregisterToolUI('chromeSearch');
        };
    }, []); // Empty dependency array - only register once on mount
}
