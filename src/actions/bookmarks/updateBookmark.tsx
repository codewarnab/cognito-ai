/**
 * Update Bookmark Tool
 * Allows AI to edit bookmark properties
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '@/ai/tools';
import { useToolUI } from '@/ai/tools/components';
import { createLogger } from '~logger';
import { CompactToolRenderer } from '@/ai/tools/components';
import type { ToolUIState } from '@/ai/tools/components';
import { safeBookmarksUpdate } from '../chromeApi/bookmarks';
import { BrowserAPIError } from '../../errors';
import type { BookmarkUpdateResult } from '../../types/bookmarks';

const log = createLogger('Tool-UpdateBookmark');

/**
 * Hook to register the updateBookmark tool
 */
export function useUpdateBookmark() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering updateBookmark tool...');

        registerTool({
            name: 'updateBookmark',
            description: `Update bookmark title or URL. Use when user asks to "rename bookmark", "change bookmark URL", "edit bookmark". Can modify title, URL, or both. Returns updated bookmark.`,

            parameters: z.object({
                bookmarkId: z.string().describe('Bookmark ID to update. Get from searchBookmarks or listBookmarks'),
                title: z.string().optional().describe('New bookmark title'),
                url: z.string().optional().describe('New bookmark URL (must be valid URL starting with http:// or https://)')
            }),

            execute: async ({ bookmarkId, title, url }): Promise<BookmarkUpdateResult> => {
                try {
                    log.info('TOOL CALL: updateBookmark', { bookmarkId, title, url });

                    if (!title && !url) {
                        throw new Error('Must provide at least title or url to update');
                    }

                    // Validate URL if provided
                    if (url) {
                        if (!url.startsWith('http://') && !url.startsWith('https://')) {
                            throw new Error('URL must start with http:// or https://');
                        }

                        if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
                            throw new Error('Cannot set URL to chrome:// or chrome-extension:// pages');
                        }
                    }

                    const changes: chrome.bookmarks.BookmarkChangesArg = {};
                    if (title) changes.title = title;
                    if (url) changes.url = url;

                    const updated = await safeBookmarksUpdate(bookmarkId, changes);

                    log.info('✅ Bookmark updated', { id: updated.id, title: updated.title });

                    return {
                        success: true,
                        id: updated.id,
                        title: updated.title,
                        url: updated.url
                    };
                } catch (error) {
                    log.error('[Tool] Error updating bookmark:', error);

                    if (error instanceof BrowserAPIError) {
                        throw error;
                    }

                    throw new Error(error instanceof Error ? error.message : 'Failed to update bookmark');
                }
            },
        });

        // Register the UI renderer
        registerToolUI('updateBookmark', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        }, {
            renderInput: (input: any) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ opacity: 0.7 }}>ID:</span>
                        <span style={{ color: 'var(--text-primary)', opacity: 0.9, fontFamily: 'monospace', fontSize: '11px' }}>
                            {input.bookmarkId}
                        </span>
                    </div>
                    {input.title && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ opacity: 0.7 }}>New title:</span>
                            <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                                {input.title}
                            </span>
                        </div>
                    )}
                    {input.url && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ opacity: 0.7 }}>New URL:</span>
                            <a href={input.url} target="_blank" rel="noopener noreferrer"
                                style={{ color: 'var(--text-primary)', textDecoration: 'none', opacity: 0.9, fontSize: '11px' }}>
                                {input.url}
                            </a>
                        </div>
                    )}
                </div>
            ),
            renderOutput: (output: any) => (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {output.success ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ opacity: 0.7 }}>✅ Updated:</span>
                                <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                                    {output.title}
                                </span>
                            </div>
                            {output.url && (
                                <a href={output.url} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: '11px', opacity: 0.6, textDecoration: 'none' }}>
                                    {output.url}
                                </a>
                            )}
                        </div>
                    ) : (
                        <span style={{ color: 'var(--error-color)' }}>Failed to update bookmark</span>
                    )}
                </div>
            )
        });

        log.info('✅ updateBookmark tool registration complete');

        return () => {
            log.info('🧹 Cleaning up updateBookmark tool');
            unregisterToolUI('updateBookmark');
        };
    }, []);
}
