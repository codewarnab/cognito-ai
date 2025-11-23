/**
 * Delete Bookmark Tool
 * Allows AI to delete bookmarks
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { createLogger } from '~logger';
import { CompactToolRenderer } from '../../ai/tools/components';
import type { ToolUIState } from '../../ai/tools/components';
import { safeBookmarksGet, safeBookmarksRemove } from '../chromeApi/bookmarks';
import { BrowserAPIError } from '../../errors';
import type { BookmarkDeleteResult } from '../../types/bookmarks';

const log = createLogger('Tool-DeleteBookmark');

/**
 * Hook to register the deleteBookmark tool
 */
export function useDeleteBookmark() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering deleteBookmark tool...');

        registerTool({
            name: 'deleteBookmark',
            description: `Delete a bookmark by ID. Use when user asks to "delete bookmark", "remove this bookmark", "delete saved link". REQUIRES CONSENT: Ask "Delete bookmark [title]?" first. Cannot undo. Cannot delete special folders (bookmarks bar, other bookmarks).`,

            parameters: z.object({
                bookmarkId: z.string().describe('Bookmark ID to delete. Get from searchBookmarks or listBookmarks')
            }),

            execute: async ({ bookmarkId }): Promise<BookmarkDeleteResult> => {
                try {
                    log.info('TOOL CALL: deleteBookmark', { bookmarkId });

                    // Validate it's not a special folder
                    const bookmarks = await safeBookmarksGet(bookmarkId);
                    if (bookmarks.length === 0) {
                        throw new Error(`Bookmark not found: ${bookmarkId}`);
                    }

                    const bookmark = bookmarks[0];
                    if (!bookmark) {
                        throw new Error(`Bookmark not found: ${bookmarkId}`);
                    }

                    // Check if it's a folder (no URL)
                    if (!bookmark.url) {
                        throw new Error('Cannot delete folders. Delete individual bookmarks instead.');
                    }

                    // Prevent deleting root folders
                    if (['0', '1', '2'].includes(bookmarkId)) {
                        throw new Error('Cannot delete special bookmark folders (root, bookmarks bar, other bookmarks)');
                    }

                    await safeBookmarksRemove(bookmarkId);

                    log.info('✅ Bookmark deleted', { id: bookmarkId });

                    return {
                        success: true,
                        deletedId: bookmarkId,
                        message: 'Bookmark deleted successfully'
                    };
                } catch (error) {
                    log.error('[Tool] Error deleting bookmark:', error);

                    if (error instanceof BrowserAPIError) {
                        throw error;
                    }

                    throw new Error(error instanceof Error ? error.message : 'Failed to delete bookmark');
                }
            },
        });

        // Register the UI renderer
        registerToolUI('deleteBookmark', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        }, {
            renderInput: (input: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span style={{ opacity: 0.7 }}>Bookmark ID:</span>
                    <span style={{ color: 'var(--text-primary)', opacity: 0.9, fontFamily: 'monospace', fontSize: '11px' }}>
                        {input.bookmarkId}
                    </span>
                </div>
            ),
            renderOutput: (output: any) => (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {output.success ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ opacity: 0.9 }}>✅ {output.message}</span>
                        </div>
                    ) : (
                        <span style={{ color: 'var(--error-color)' }}>Failed to delete bookmark</span>
                    )}
                </div>
            )
        });

        log.info('✅ deleteBookmark tool registration complete');

        return () => {
            log.info('🧹 Cleaning up deleteBookmark tool');
            unregisterToolUI('deleteBookmark');
        };
    }, []);
}
